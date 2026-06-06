import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupervisorControlsRepository } from './supervisor-controls.repository.js';
import type { SupervisorControl } from './supervisor-controls.types.js';
import {
  SupervisorControlNotFoundError,
  SupervisorControlTransitionError,
  SupervisorControlValidationError,
  SupervisorControlsService,
} from './supervisor-controls.service.js';

const TENANT = 'tenant-1';
const CONTROL_ID = 'ctrl-1';

const baseControl: SupervisorControl = {
  id: CONTROL_ID,
  tenant_id: TENANT,
  supervisor_user_id: 'user-1',
  control_type: 'monitor',
  target_call_id: 'call-abc',
  status: 'pending',
  audit_note: null,
  created_at: new Date(),
  updated_at: new Date(),
  ended_at: null,
};

function makeRepo(overrides: Partial<SupervisorControlsRepository> = {}): SupervisorControlsRepository {
  return {
    findAllByTenant: vi.fn().mockResolvedValue([baseControl]),
    findById: vi.fn().mockResolvedValue(baseControl),
    create: vi.fn().mockResolvedValue(baseControl),
    update: vi.fn().mockResolvedValue(baseControl),
    setStatus: vi.fn().mockResolvedValue({ ...baseControl, status: 'ended', ended_at: new Date() }),
    ...overrides,
  } as unknown as SupervisorControlsRepository;
}

describe('SupervisorControlsService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: SupervisorControlsService;

  beforeEach(() => {
    repo = makeRepo();
    service = new SupervisorControlsService(repo);
  });

  it('creates a control session', async () => {
    await service.create({
      tenant_id: TENANT,
      supervisor_user_id: 'user-1',
      control_type: 'monitor',
      target_call_id: 'call-abc',
    });
    expect(vi.mocked(repo.create)).toHaveBeenCalled();
  });

  it('rejects empty target_call_id', async () => {
    await expect(service.create({
      tenant_id: TENANT,
      supervisor_user_id: 'user-1',
      control_type: 'monitor',
      target_call_id: '   ',
    })).rejects.toBeInstanceOf(SupervisorControlValidationError);
  });

  it('throws not-found when id missing', async () => {
    repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    service = new SupervisorControlsService(repo);
    await expect(service.getById('missing', TENANT)).rejects.toBeInstanceOf(SupervisorControlNotFoundError);
  });

  it('allows valid transition: pending → active', async () => {
    await service.update(CONTROL_ID, TENANT, { status: 'active' });
    expect(vi.mocked(repo.update)).toHaveBeenCalledWith(CONTROL_ID, TENANT, { status: 'active' });
  });

  it('rejects invalid transition: ended → active', async () => {
    repo = makeRepo({ findById: vi.fn().mockResolvedValue({ ...baseControl, status: 'ended' }) });
    service = new SupervisorControlsService(repo);
    await expect(service.update(CONTROL_ID, TENANT, { status: 'active' }))
      .rejects.toBeInstanceOf(SupervisorControlTransitionError);
  });

  it('end() sets status to ended', async () => {
    repo = makeRepo({ findById: vi.fn().mockResolvedValue({ ...baseControl, status: 'active' }) });
    service = new SupervisorControlsService(repo);
    const result = await service.end(CONTROL_ID, TENANT);
    expect(result.status).toBe('ended');
  });

  it('end() is idempotent when already ended', async () => {
    repo = makeRepo({ findById: vi.fn().mockResolvedValue({ ...baseControl, status: 'ended' }) });
    service = new SupervisorControlsService(repo);
    const result = await service.end(CONTROL_ID, TENANT);
    expect(result.status).toBe('ended');
    expect(vi.mocked(repo.setStatus)).not.toHaveBeenCalled();
  });
});
