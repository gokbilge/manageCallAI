import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CallGroupService,
  CallGroupNotFoundError,
  CallGroupMemberInvalidError,
  CallGroupMemberNotFoundError,
} from './call-group.service.js';
import type { CallGroupRepository } from './call-group.repository.js';
import type { CallGroup, CallGroupMember, CallGroupWithMembers } from './call-group.types.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const GROUP_ID  = '00000000-0000-0000-0000-000000000010';
const EXT_ID    = '00000000-0000-0000-0000-000000000050';
const now = new Date();

function makeGroup(overrides: Partial<CallGroup> = {}): CallGroup {
  return {
    id: GROUP_ID,
    tenant_id: TENANT_ID,
    name: 'Support Team',
    description: null,
    strategy: 'simultaneous',
    status: 'active',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeGroupWithMembers(overrides: Partial<CallGroupWithMembers> = {}): CallGroupWithMembers {
  return { ...makeGroup(), members: [], ...overrides };
}

function makeMember(overrides: Partial<CallGroupMember> = {}): CallGroupMember {
  return {
    id: 'mem-1',
    call_group_id: GROUP_ID,
    tenant_id: TENANT_ID,
    extension_id: EXT_ID,
    extension_number: '101',
    display_name: 'Alice',
    position: 0,
    created_at: now,
    ...overrides,
  };
}

function makeMockRepo(): CallGroupRepository {
  return {
    findAllByTenant: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    findActiveExtension: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    isActiveTarget: vi.fn(),
  } as unknown as CallGroupRepository;
}

describe('CallGroupService', () => {
  let repo: CallGroupRepository;
  let service: CallGroupService;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new CallGroupService(repo);
  });

  describe('listByTenant', () => {
    it('delegates to repo', async () => {
      const groups = [makeGroup()];
      vi.mocked(repo.findAllByTenant).mockResolvedValue(groups);

      const result = await service.listByTenant(TENANT_ID);

      expect(result).toBe(groups);
      expect(repo.findAllByTenant).toHaveBeenCalledWith(TENANT_ID);
    });
  });

  describe('getById', () => {
    it('returns group with members when found', async () => {
      const group = makeGroupWithMembers();
      vi.mocked(repo.findById).mockResolvedValue(group);

      const result = await service.getById(GROUP_ID, TENANT_ID);

      expect(result).toBe(group);
    });

    it('throws CallGroupNotFoundError when not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(service.getById(GROUP_ID, TENANT_ID)).rejects.toThrow(CallGroupNotFoundError);
    });
  });

  describe('create', () => {
    it('creates group and returns it with empty members', async () => {
      const group = makeGroupWithMembers();
      vi.mocked(repo.create).mockResolvedValue(group);

      const result = await service.create({ tenant_id: TENANT_ID, name: 'Support Team' });

      expect(result).toBe(group);
      expect(repo.create).toHaveBeenCalledWith({ tenant_id: TENANT_ID, name: 'Support Team' });
    });
  });

  describe('update', () => {
    it('updates and returns the group', async () => {
      const updated = makeGroup({ strategy: 'sequential' });
      vi.mocked(repo.update).mockResolvedValue(updated);

      const result = await service.update(GROUP_ID, TENANT_ID, { strategy: 'sequential' });

      expect(result.strategy).toBe('sequential');
    });

    it('throws CallGroupNotFoundError when group does not exist', async () => {
      vi.mocked(repo.update).mockResolvedValue(null);

      await expect(service.update(GROUP_ID, TENANT_ID, { name: 'X' })).rejects.toThrow(CallGroupNotFoundError);
    });
  });

  describe('deactivate', () => {
    it('deactivates the group', async () => {
      const deactivated = makeGroup({ status: 'inactive' });
      vi.mocked(repo.deactivate).mockResolvedValue(deactivated);

      const result = await service.deactivate(GROUP_ID, TENANT_ID);

      expect(result.status).toBe('inactive');
    });

    it('throws CallGroupNotFoundError when group does not exist', async () => {
      vi.mocked(repo.deactivate).mockResolvedValue(null);

      await expect(service.deactivate(GROUP_ID, TENANT_ID)).rejects.toThrow(CallGroupNotFoundError);
    });
  });

  describe('addMember', () => {
    it('adds member when group exists and extension is active', async () => {
      const group = makeGroupWithMembers();
      const member = makeMember();
      vi.mocked(repo.findById).mockResolvedValue(group);
      vi.mocked(repo.findActiveExtension).mockResolvedValue({ id: EXT_ID });
      vi.mocked(repo.addMember).mockResolvedValue(member);

      const result = await service.addMember(GROUP_ID, TENANT_ID, { extension_id: EXT_ID });

      expect(result).toBe(member);
      expect(repo.findActiveExtension).toHaveBeenCalledWith(EXT_ID, TENANT_ID);
      expect(repo.addMember).toHaveBeenCalledWith(GROUP_ID, TENANT_ID, { extension_id: EXT_ID });
    });

    it('throws CallGroupNotFoundError when group does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(service.addMember(GROUP_ID, TENANT_ID, { extension_id: EXT_ID }))
        .rejects.toThrow(CallGroupNotFoundError);
    });

    it('throws CallGroupMemberInvalidError when extension is not active', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeGroupWithMembers());
      vi.mocked(repo.findActiveExtension).mockResolvedValue(null);

      await expect(service.addMember(GROUP_ID, TENANT_ID, { extension_id: EXT_ID }))
        .rejects.toThrow(CallGroupMemberInvalidError);
    });
  });

  describe('removeMember', () => {
    it('removes member successfully', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeGroupWithMembers());
      vi.mocked(repo.removeMember).mockResolvedValue(true);

      await expect(service.removeMember(GROUP_ID, EXT_ID, TENANT_ID)).resolves.toBeUndefined();
    });

    it('throws CallGroupNotFoundError when group does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(service.removeMember(GROUP_ID, EXT_ID, TENANT_ID)).rejects.toThrow(CallGroupNotFoundError);
    });

    it('throws CallGroupMemberNotFoundError when member does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeGroupWithMembers());
      vi.mocked(repo.removeMember).mockResolvedValue(false);

      await expect(service.removeMember(GROUP_ID, EXT_ID, TENANT_ID))
        .rejects.toThrow(CallGroupMemberNotFoundError);
    });
  });
});
