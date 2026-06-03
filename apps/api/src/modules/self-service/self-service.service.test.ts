import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SelfServiceService,
  SelfServiceCapabilityError,
  SelfServiceExtensionNotFoundError,
} from './self-service.service.js';
import type { SelfServiceRepository } from './self-service.repository.js';
import type { ExtensionSelfServiceState, SelfServicePolicy } from './self-service.types.js';

const makeExt = (overrides: Partial<ExtensionSelfServiceState> = {}): ExtensionSelfServiceState => ({
  id: 'ext-1',
  extension_number: '101',
  display_name: 'Alice',
  dnd_enabled: false,
  call_forward_enabled: false,
  call_forward_target: null,
  ...overrides,
});

const makePolicy = (overrides: Partial<SelfServicePolicy> = {}): SelfServicePolicy => ({
  id: 'pol-1',
  tenant_id: 'tenant-1',
  voicemail_view: true,
  voicemail_pin_change: true,
  dnd_manage: true,
  call_forward_manage: true,
  call_forward_set_target: true,
  call_history_view: true,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

function makeRepo(overrides: Partial<SelfServiceRepository> = {}): SelfServiceRepository {
  return {
    findExtensionByUserId: vi.fn().mockResolvedValue(makeExt()),
    setDnd: vi.fn().mockResolvedValue(makeExt({ dnd_enabled: true })),
    setCallForward: vi.fn().mockResolvedValue(makeExt({ call_forward_enabled: true, call_forward_target: '+15555550100' })),
    findPolicy: vi.fn().mockResolvedValue(makePolicy()),
    upsertPolicy: vi.fn().mockResolvedValue(makePolicy()),
    ...overrides,
  } as unknown as SelfServiceRepository;
}

describe('SelfServiceService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: SelfServiceService;

  beforeEach(() => {
    repo = makeRepo();
    service = new SelfServiceService(repo);
  });

  describe('getPolicy', () => {
    it('returns stored policy when it exists', async () => {
      const policy = await service.getPolicy('tenant-1');
      expect(policy.dnd_manage).toBe(true);
    });

    it('returns default policy when none exists', async () => {
      repo = makeRepo({ findPolicy: vi.fn().mockResolvedValue(null) });
      service = new SelfServiceService(repo);
      const policy = await service.getPolicy('tenant-1');
      expect(policy.dnd_manage).toBe(true);
      expect(policy.call_forward_manage).toBe(false);
    });
  });

  describe('updatePolicy', () => {
    it('upserts policy fields', async () => {
      const policy = await service.updatePolicy('tenant-1', { dnd_manage: false });
      expect(policy).toBeDefined();
      expect(vi.mocked(repo.upsertPolicy)).toHaveBeenCalledWith('tenant-1', { dnd_manage: false });
    });
  });

  describe('getMyExtension', () => {
    it('returns extension for user', async () => {
      const ext = await service.getMyExtension('user-1', 'tenant-1');
      expect(ext.extension_number).toBe('101');
    });

    it('throws when no extension found', async () => {
      repo = makeRepo({ findExtensionByUserId: vi.fn().mockResolvedValue(null) });
      service = new SelfServiceService(repo);
      await expect(service.getMyExtension('user-1', 'tenant-1')).rejects.toThrow(SelfServiceExtensionNotFoundError);
    });
  });

  describe('setDnd', () => {
    it('enables DND successfully', async () => {
      const ext = await service.setDnd('user-1', 'tenant-1', true);
      expect(ext.dnd_enabled).toBe(true);
      expect(vi.mocked(repo.setDnd)).toHaveBeenCalledWith('ext-1', 'tenant-1', true);
    });

    it('throws SelfServiceCapabilityError when dnd_manage is disabled', async () => {
      repo = makeRepo({ findPolicy: vi.fn().mockResolvedValue(makePolicy({ dnd_manage: false })) });
      service = new SelfServiceService(repo);
      await expect(service.setDnd('user-1', 'tenant-1', true)).rejects.toThrow(SelfServiceCapabilityError);
    });

    it('throws when extension not found', async () => {
      repo = makeRepo({ findExtensionByUserId: vi.fn().mockResolvedValue(null) });
      service = new SelfServiceService(repo);
      await expect(service.setDnd('user-1', 'tenant-1', true)).rejects.toThrow(SelfServiceExtensionNotFoundError);
    });
  });

  describe('setCallForward', () => {
    it('enables call forward with target', async () => {
      const ext = await service.setCallForward('user-1', 'tenant-1', true, '+15555550100');
      expect(ext.call_forward_enabled).toBe(true);
    });

    it('throws when call_forward_manage disabled', async () => {
      repo = makeRepo({ findPolicy: vi.fn().mockResolvedValue(makePolicy({ call_forward_manage: false })) });
      service = new SelfServiceService(repo);
      await expect(service.setCallForward('user-1', 'tenant-1', true)).rejects.toThrow(SelfServiceCapabilityError);
    });

    it('throws when call_forward_set_target disabled but target provided', async () => {
      repo = makeRepo({ findPolicy: vi.fn().mockResolvedValue(makePolicy({ call_forward_set_target: false })) });
      service = new SelfServiceService(repo);
      await expect(service.setCallForward('user-1', 'tenant-1', true, '+15555550100')).rejects.toThrow(SelfServiceCapabilityError);
    });

    it('allows enable without target when call_forward_set_target is disabled', async () => {
      repo = makeRepo({ findPolicy: vi.fn().mockResolvedValue(makePolicy({ call_forward_set_target: false })) });
      service = new SelfServiceService(repo);
      await expect(service.setCallForward('user-1', 'tenant-1', true)).resolves.toBeDefined();
    });
  });

  describe('getCallForward', () => {
    it('returns call forward state', async () => {
      const result = await service.getCallForward('user-1', 'tenant-1');
      expect(result.call_forward_enabled).toBeDefined();
    });

    it('throws when call_forward_manage disabled', async () => {
      repo = makeRepo({ findPolicy: vi.fn().mockResolvedValue(makePolicy({ call_forward_manage: false })) });
      service = new SelfServiceService(repo);
      await expect(service.getCallForward('user-1', 'tenant-1')).rejects.toThrow(SelfServiceCapabilityError);
    });
  });

  describe('getDnd', () => {
    it('returns DND state', async () => {
      const result = await service.getDnd('user-1', 'tenant-1');
      expect(result.dnd_enabled).toBe(false);
    });
  });
});
