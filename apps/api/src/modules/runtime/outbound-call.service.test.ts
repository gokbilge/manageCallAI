import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OutboundCallService,
  OutboundCallValidationError,
  OutboundCallNotFoundError,
} from './outbound-call.service.js';
import type { OutboundCallRepository } from './outbound-call.repository.js';
import type { OutboundCallRequest } from './outbound-call.types.js';

vi.mock('../audit/fire-audit.js', () => ({ fireAuditEvent: vi.fn() }));

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
  failure_reason: null,
  created_at: new Date(),
  updated_at: new Date(),
};

function makeRepo(overrides: Partial<OutboundCallRepository> = {}): OutboundCallRepository {
  return {
    create: vi.fn().mockResolvedValue(baseRequest),
    findById: vi.fn().mockResolvedValue(baseRequest),
    findByTenant: vi.fn().mockResolvedValue([baseRequest]),
    findPendingByTenant: vi.fn().mockResolvedValue([baseRequest]),
    claimRequest: vi.fn().mockResolvedValue({ ...baseRequest, status: 'dispatched' }),
    updateStatus: vi.fn().mockResolvedValue({ ...baseRequest, status: 'dispatched' }),
    findActiveExtension: vi.fn().mockResolvedValue({ id: EXT_ID }),
    resolveRouteForNumber: vi.fn().mockResolvedValue({
      route_id: ROUTE_ID,
      sip_trunk_id: TRUNK_ID,
      max_calls_per_minute: null,
      allowed_destination_prefixes_json: null,
      blocked_destination_prefixes_json: null,
    }),
    findActiveRouteById: vi.fn().mockResolvedValue({
      id: ROUTE_ID,
      sip_trunk_id: TRUNK_ID,
      max_calls_per_minute: null,
      allowed_destination_prefixes_json: null,
      blocked_destination_prefixes_json: null,
    }),
    findActiveTrunk: vi.fn().mockResolvedValue({ id: TRUNK_ID }),
    countRecentAttempts: vi.fn().mockResolvedValue(0),
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

    it('rejects calls when prefix resolution finds no active route', async () => {
      repo = makeRepo({ resolveRouteForNumber: vi.fn().mockResolvedValue(null) });
      service = new OutboundCallService(repo);
      await expect(
        service.create({ tenant_id: TENANT, extension_id: EXT_ID, dial_number: '+905551234567' }),
      ).rejects.toBeInstanceOf(OutboundCallValidationError);
    });

    it('trims whitespace from dial_number', async () => {
      await service.create({ tenant_id: TENANT, extension_id: EXT_ID, dial_number: ' +905551234567 ' });
      expect(vi.mocked(repo.create)).toHaveBeenCalledWith(
        expect.objectContaining({ dial_number: '+905551234567' }),
      );
    });

    it('blocks emergency destinations before dispatch', async () => {
      await expect(
        service.create({ tenant_id: TENANT, extension_id: EXT_ID, dial_number: '911' }),
      ).rejects.toBeInstanceOf(OutboundCallValidationError);
      expect(vi.mocked(repo.create)).not.toHaveBeenCalled();
    });

    it('blocks premium-rate destinations before dispatch', async () => {
      await expect(
        service.create({ tenant_id: TENANT, extension_id: EXT_ID, dial_number: '+19005551234' }),
      ).rejects.toBeInstanceOf(OutboundCallValidationError);
      expect(vi.mocked(repo.create)).not.toHaveBeenCalled();
    });

    it('enforces route destination blocklist', async () => {
      repo = makeRepo({
        resolveRouteForNumber: vi.fn().mockResolvedValue({
          route_id: ROUTE_ID,
          sip_trunk_id: TRUNK_ID,
          max_calls_per_minute: null,
          allowed_destination_prefixes_json: null,
          blocked_destination_prefixes_json: ['+90555'],
        }),
      });
      service = new OutboundCallService(repo);
      await expect(
        service.create({ tenant_id: TENANT, extension_id: EXT_ID, dial_number: '+905551234567' }),
      ).rejects.toBeInstanceOf(OutboundCallValidationError);
    });

    it('enforces route destination allowlist', async () => {
      repo = makeRepo({
        resolveRouteForNumber: vi.fn().mockResolvedValue({
          route_id: ROUTE_ID,
          sip_trunk_id: TRUNK_ID,
          max_calls_per_minute: null,
          allowed_destination_prefixes_json: ['+1'],
          blocked_destination_prefixes_json: null,
        }),
      });
      service = new OutboundCallService(repo);
      await expect(
        service.create({ tenant_id: TENANT, extension_id: EXT_ID, dial_number: '+905551234567' }),
      ).rejects.toBeInstanceOf(OutboundCallValidationError);
    });

    it('enforces outbound route per-minute rate caps before persistence', async () => {
      repo = makeRepo({
        resolveRouteForNumber: vi.fn().mockResolvedValue({
          route_id: ROUTE_ID,
          sip_trunk_id: TRUNK_ID,
          max_calls_per_minute: 2,
          allowed_destination_prefixes_json: null,
          blocked_destination_prefixes_json: null,
        }),
        countRecentAttempts: vi.fn().mockResolvedValue(2),
      });
      service = new OutboundCallService(repo);

      await expect(
        service.create({ tenant_id: TENANT, extension_id: EXT_ID, dial_number: '+905551234567' }),
      ).rejects.toThrow('Outbound route rate limit exceeded');
      expect(vi.mocked(repo.create)).not.toHaveBeenCalled();
      expect(vi.mocked(repo.countRecentAttempts)).toHaveBeenCalledWith(TENANT, ROUTE_ID, TRUNK_ID, 60);
    });
  });

  describe('getById', () => {
    it('returns the request when found', async () => {
      const result = await service.getById(baseRequest.id, TENANT);
      expect(result.id).toBe(baseRequest.id);
      expect(vi.mocked(repo.findById)).toHaveBeenCalledWith(baseRequest.id, TENANT);
    });

    it('throws OutboundCallNotFoundError when not found', async () => {
      repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
      service = new OutboundCallService(repo);
      await expect(service.getById('missing-id', TENANT)).rejects.toBeInstanceOf(OutboundCallNotFoundError);
    });
  });

  describe('listByTenant', () => {
    it('returns all requests for tenant', async () => {
      const result = await service.listByTenant(TENANT);
      expect(result).toHaveLength(1);
      expect(vi.mocked(repo.findByTenant)).toHaveBeenCalledWith(TENANT, undefined);
    });

    it('passes status filter to repo', async () => {
      await service.listByTenant(TENANT, 'failed');
      expect(vi.mocked(repo.findByTenant)).toHaveBeenCalledWith(TENANT, 'failed');
    });
  });

  describe('getPendingByTenant', () => {
    it('returns pending requests', async () => {
      const result = await service.getPendingByTenant(TENANT);
      expect(result).toHaveLength(1);
      expect(vi.mocked(repo.findPendingByTenant)).toHaveBeenCalledWith(TENANT);
    });
  });

  describe('claimRequest', () => {
    it('claims a pending request', async () => {
      const result = await service.claimRequest(baseRequest.id, TENANT);
      expect(result.status).toBe('dispatched');
      expect(vi.mocked(repo.claimRequest)).toHaveBeenCalledWith(baseRequest.id, TENANT);
    });

    it('throws OutboundCallNotFoundError when already claimed or missing', async () => {
      repo = makeRepo({ claimRequest: vi.fn().mockResolvedValue(null) });
      service = new OutboundCallService(repo);
      await expect(service.claimRequest('id', TENANT)).rejects.toBeInstanceOf(OutboundCallNotFoundError);
    });
  });

  describe('updateStatus', () => {
    it('marks as dispatched', async () => {
      const result = await service.updateStatus(baseRequest.id, TENANT, 'dispatched');
      expect(result.status).toBe('dispatched');
    });

    it('accepts failure_reason for failed status', async () => {
      const failed = { ...baseRequest, status: 'failed' as const, failure_reason: 'no answer' };
      repo = makeRepo({ updateStatus: vi.fn().mockResolvedValue(failed) });
      service = new OutboundCallService(repo);
      const result = await service.updateStatus(baseRequest.id, TENANT, 'failed', 'no answer');
      expect(result.failure_reason).toBe('no answer');
      expect(vi.mocked(repo.updateStatus)).toHaveBeenCalledWith(baseRequest.id, TENANT, 'failed', 'no answer');
    });

    it('accepts answered and completed statuses', async () => {
      for (const s of ['answered', 'completed'] as const) {
        repo = makeRepo({ updateStatus: vi.fn().mockResolvedValue({ ...baseRequest, status: s }) });
        service = new OutboundCallService(repo);
        const result = await service.updateStatus(baseRequest.id, TENANT, s);
        expect(result.status).toBe(s);
      }
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
