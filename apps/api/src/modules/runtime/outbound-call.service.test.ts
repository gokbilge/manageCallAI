import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OutboundCallService,
  OutboundCallValidationError,
  OutboundCallNotFoundError,
} from './outbound-call.service.js';
import type { OutboundCallRepository } from './outbound-call.repository.js';
import type { OutboundCallRequest } from './outbound-call.types.js';

const TENANT = 'tenant-1';
const EXT_ID = '00000000-0000-0000-0000-000000000010';
const TRUNK_ID = '00000000-0000-0000-0000-000000000020';
const ROUTE_ID = '00000000-0000-0000-0000-000000000030';

const baseRequest: OutboundCallRequest = {
  id: '00000000-0000-0000-0000-000000000001',
  tenant_id: TENANT,
  extension_id: EXT_ID,
  dial_number: '+905551234567',
  route_id: ROUTE_ID,
  sip_trunk_id: TRUNK_ID,
  status: 'pending',
  created_at: new Date(),
  updated_at: new Date(),
};

function makeRepo(overrides: Partial<OutboundCallRepository> = {}): OutboundCallRepository {
  return {
    create: vi.fn().mockResolvedValue(baseRequest),
    findById: vi.fn().mockResolvedValue(baseRequest),
    findPendingByTenant: vi.fn().mockResolvedValue([baseRequest]),
    updateStatus: vi.fn().mockResolvedValue({ ...baseRequest, status: 'dispatched' }),
    findActiveExtension: vi.fn().mockResolvedValue({ id: EXT_ID }),
    resolveRouteForNumber: vi.fn().mockResolvedValue({ route_id: ROUTE_ID, sip_trunk_id: TRUNK_ID }),
    findActiveRouteById: vi.fn().mockResolvedValue({ id: ROUTE_ID, sip_trunk_id: TRUNK_ID }),
    findActiveTrunk: vi.fn().mockResolvedValue({ id: TRUNK_ID }),
    ...overrides,
  } as unknown as OutboundCallRepository;
}

describe('OutboundCallService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: OutboundCallService;

  beforeEach(() => {
    repo = makeRepo();
    service = new OutboundCallService(repo);
  });

  describe('create', () => {
    it('rejects invalid dial_number', async () => {
      await expect(
        service.create({ tenant_id: TENANT, extension_id: EXT_ID, dial_number: 'abc' }),
      ).rejects.toBeInstanceOf(OutboundCallValidationError);
    });

    it('rejects dial_number that is too short', async () => {
      await expect(
        service.create({ tenant_id: TENANT, extension_id: EXT_ID, dial_number: '12' }),
      ).rejects.toBeInstanceOf(OutboundCallValidationError);
    });

    it('rejects unknown extension', async () => {
      repo = makeRepo({ findActiveExtension: vi.fn().mockResolvedValue(null) });
      service = new OutboundCallService(repo);
      await expect(
        service.create({ tenant_id: TENANT, extension_id: EXT_ID, dial_number: '+905551234567' }),
      ).rejects.toBeInstanceOf(OutboundCallValidationError);
    });

    it('rejects inactive route_id', async () => {
      repo = makeRepo({ findActiveRouteById: vi.fn().mockResolvedValue(null) });
      service = new OutboundCallService(repo);
      await expect(
        service.create({ tenant_id: TENANT, extension_id: EXT_ID, dial_number: '+905551234567', route_id: ROUTE_ID }),
      ).rejects.toBeInstanceOf(OutboundCallValidationError);
    });

    it('rejects when resolved trunk is inactive', async () => {
      repo = makeRepo({ findActiveTrunk: vi.fn().mockResolvedValue(null) });
      service = new OutboundCallService(repo);
      await expect(
        service.create({ tenant_id: TENANT, extension_id: EXT_ID, dial_number: '+905551234567' }),
      ).rejects.toBeInstanceOf(OutboundCallValidationError);
    });

    it('creates call request with explicit route_id', async () => {
      const result = await service.create({
        tenant_id: TENANT,
        extension_id: EXT_ID,
        dial_number: '+905551234567',
        route_id: ROUTE_ID,
      });
      expect(result.id).toBe(baseRequest.id);
      expect(vi.mocked(repo.findActiveRouteById)).toHaveBeenCalledWith(TENANT, ROUTE_ID);
      expect(vi.mocked(repo.resolveRouteForNumber)).not.toHaveBeenCalled();
    });

    it('auto-resolves route when route_id is absent', async () => {
      const result = await service.create({
        tenant_id: TENANT,
        extension_id: EXT_ID,
        dial_number: '+905551234567',
      });
      expect(result.id).toBe(baseRequest.id);
      expect(vi.mocked(repo.resolveRouteForNumber)).toHaveBeenCalledWith(TENANT, '+905551234567');
      expect(vi.mocked(repo.findActiveRouteById)).not.toHaveBeenCalled();
    });

    it('creates call with no route when prefix resolution finds nothing', async () => {
      repo = makeRepo({ resolveRouteForNumber: vi.fn().mockResolvedValue(null) });
      service = new OutboundCallService(repo);
      await service.create({ tenant_id: TENANT, extension_id: EXT_ID, dial_number: '+905551234567' });
      expect(vi.mocked(repo.create)).toHaveBeenCalledWith(
        expect.objectContaining({ route_id: null, sip_trunk_id: null }),
      );
    });

    it('trims whitespace from dial_number', async () => {
      await service.create({ tenant_id: TENANT, extension_id: EXT_ID, dial_number: ' +905551234567 ' });
      expect(vi.mocked(repo.create)).toHaveBeenCalledWith(
        expect.objectContaining({ dial_number: '+905551234567' }),
      );
    });
  });

  describe('getPendingByTenant', () => {
    it('returns pending requests', async () => {
      const result = await service.getPendingByTenant(TENANT);
      expect(result).toHaveLength(1);
      expect(vi.mocked(repo.findPendingByTenant)).toHaveBeenCalledWith(TENANT);
    });
  });

  describe('updateStatus', () => {
    it('marks as dispatched', async () => {
      const result = await service.updateStatus(baseRequest.id, TENANT, 'dispatched');
      expect(result.status).toBe('dispatched');
    });

    it('throws OutboundCallNotFoundError when not found', async () => {
      repo = makeRepo({ updateStatus: vi.fn().mockResolvedValue(null) });
      service = new OutboundCallService(repo);
      await expect(
        service.updateStatus('missing-id', TENANT, 'dispatched'),
      ).rejects.toBeInstanceOf(OutboundCallNotFoundError);
    });
  });
});
