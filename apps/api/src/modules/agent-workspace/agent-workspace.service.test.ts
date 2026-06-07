import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentWorkspaceRepository } from './agent-workspace.repository.js';
import type { AgentAvailability, AgentProfileWithAvailability } from './agent-workspace.types.js';
import {
  AgentAvailabilityTransitionError,
  AgentNotFoundError,
  AgentValidationError,
  AgentWorkspaceService,
} from './agent-workspace.service.js';

const TENANT = 'tenant-1';
const AGENT_ID = 'agent-1';
const USER_ID = 'user-1';

const baseProfile: AgentProfileWithAvailability = {
  id: AGENT_ID,
  tenant_id: TENANT,
  user_id: USER_ID,
  display_name: 'Alice Support',
  max_concurrent_calls: 1,
  status: 'active',
  created_at: new Date(),
  updated_at: new Date(),
  availability: null,
};

const baseAvailability: AgentAvailability = {
  id: 'av-1',
  tenant_id: TENANT,
  agent_profile_id: AGENT_ID,
  state: 'offline',
  reason: null,
  updated_at: new Date(),
};

function makeRepo(overrides: Partial<AgentWorkspaceRepository> = {}): AgentWorkspaceRepository {
  return {
    findAllByTenant: vi.fn().mockResolvedValue([baseProfile]),
    findById: vi.fn().mockResolvedValue(baseProfile),
    findByUserId: vi.fn().mockResolvedValue(baseProfile),
    create: vi.fn().mockResolvedValue(baseProfile),
    update: vi.fn().mockResolvedValue(baseProfile),
    deactivate: vi.fn().mockResolvedValue({ ...baseProfile, status: 'inactive' }),
    getAvailability: vi.fn().mockResolvedValue(baseAvailability),
    upsertAvailability: vi.fn().mockResolvedValue({ ...baseAvailability, state: 'available' }),
    findAvailableByQueue: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as AgentWorkspaceRepository;
}

describe('AgentWorkspaceService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: AgentWorkspaceService;

  beforeEach(() => {
    repo = makeRepo();
    service = new AgentWorkspaceService(repo);
  });

  it('creates a profile with defaults', async () => {
    await service.create({ tenant_id: TENANT, user_id: USER_ID, display_name: 'Alice' });
    expect(vi.mocked(repo.create)).toHaveBeenCalledWith(expect.objectContaining({
      display_name: 'Alice',
    }));
  });

  it('lists profiles for a tenant', async () => {
    const result = await service.listByTenant(TENANT);
    expect(result).toHaveLength(1);
    expect(vi.mocked(repo.findAllByTenant)).toHaveBeenCalledWith(TENANT);
  });

  it('rejects invalid max_concurrent_calls', async () => {
    await expect(service.create({ tenant_id: TENANT, user_id: USER_ID, display_name: 'Alice', max_concurrent_calls: 0 }))
      .rejects.toBeInstanceOf(AgentValidationError);
    await expect(service.create({ tenant_id: TENANT, user_id: USER_ID, display_name: 'Alice', max_concurrent_calls: 11 }))
      .rejects.toBeInstanceOf(AgentValidationError);
  });

  it('throws AgentNotFoundError when profile not found', async () => {
    repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    service = new AgentWorkspaceService(repo);
    await expect(service.getById('missing', TENANT)).rejects.toBeInstanceOf(AgentNotFoundError);
  });

  it('gets workspace for a user', async () => {
    const result = await service.getWorkspaceForUser(USER_ID, TENANT);
    expect(result.id).toBe(AGENT_ID);
    expect(vi.mocked(repo.findByUserId)).toHaveBeenCalledWith(USER_ID, TENANT);
  });

  it('throws AgentNotFoundError when workspace user is missing', async () => {
    repo = makeRepo({ findByUserId: vi.fn().mockResolvedValue(null) });
    service = new AgentWorkspaceService(repo);
    await expect(service.getWorkspaceForUser('missing-user', TENANT)).rejects.toBeInstanceOf(AgentNotFoundError);
  });

  it('updates a profile', async () => {
    const result = await service.update(AGENT_ID, TENANT, { display_name: 'Alice Updated', max_concurrent_calls: 2 });
    expect(result.display_name).toBe('Alice Support');
    expect(vi.mocked(repo.update)).toHaveBeenCalledWith(
      AGENT_ID,
      TENANT,
      expect.objectContaining({ display_name: 'Alice Updated', max_concurrent_calls: 2 }),
    );
  });

  it('throws when updating a missing profile', async () => {
    repo = makeRepo({ update: vi.fn().mockResolvedValue(null) });
    service = new AgentWorkspaceService(repo);
    await expect(service.update(AGENT_ID, TENANT, { display_name: 'Missing' })).rejects.toBeInstanceOf(AgentNotFoundError);
  });

  it('allows valid availability transitions: offline → available', async () => {
    const result = await service.setAvailability(AGENT_ID, TENANT, { state: 'available' });
    expect(result.state).toBe('available');
  });

  it('rejects invalid availability transitions: away → busy', async () => {
    repo = makeRepo({
      getAvailability: vi.fn().mockResolvedValue({ ...baseAvailability, state: 'away' }),
    });
    service = new AgentWorkspaceService(repo);
    await expect(service.setAvailability(AGENT_ID, TENANT, { state: 'busy' }))
      .rejects.toBeInstanceOf(AgentAvailabilityTransitionError);
  });

  it('treats missing availability record as offline for transition', async () => {
    repo = makeRepo({ getAvailability: vi.fn().mockResolvedValue(null) });
    service = new AgentWorkspaceService(repo);
    // offline → available is valid
    await expect(service.setAvailability(AGENT_ID, TENANT, { state: 'available' })).resolves.toBeDefined();
  });

  it('deactivates an agent profile', async () => {
    const result = await service.deactivate(AGENT_ID, TENANT);
    expect(result.status).toBe('inactive');
  });

  it('sets availability for a user by resolving the profile first', async () => {
    const result = await service.setAvailabilityForUser(USER_ID, TENANT, { state: 'available' });
    expect(result.state).toBe('available');
    expect(vi.mocked(repo.findByUserId)).toHaveBeenCalledWith(USER_ID, TENANT);
  });

  it('throws when setting availability for a missing user', async () => {
    repo = makeRepo({ findByUserId: vi.fn().mockResolvedValue(null) });
    service = new AgentWorkspaceService(repo);
    await expect(service.setAvailabilityForUser('missing-user', TENANT, { state: 'available' })).rejects.toBeInstanceOf(AgentNotFoundError);
  });

  it('lists queue-eligible agents', async () => {
    const result = await service.listAvailableForQueue('queue-1', TENANT);
    expect(result).toHaveLength(0);
    expect(vi.mocked(repo.findAvailableByQueue)).toHaveBeenCalledWith('queue-1', TENANT);
  });
});
