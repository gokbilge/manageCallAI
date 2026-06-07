import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduleService, ScheduleNotFoundError, ScheduleValidationError } from './schedule.service.js';
import type { ScheduleRepository } from './schedule.repository.js';
import type { Schedule } from './schedule.types.js';
import type { EnterpriseLifecycleService } from '../shared/enterprise-lifecycle.service.js';
import type { EnterpriseVersion, EnterprisePublishAttemptResult, EnterpriseDryRunResult } from '../shared/enterprise-lifecycle.types.js';

const baseSchedule: Schedule = {
  id: 'sched-1',
  tenant_id: 'tenant-1',
  name: 'Business Hours',
  status: 'active',
  timezone: 'America/New_York',
  weekly_rules_json: [{ day_of_week: 1, open_time: '09:00', close_time: '17:00' }],
  holiday_overrides_json: [],
  created_at: new Date(),
  updated_at: new Date(),
};

function makeRepo(overrides: Partial<ScheduleRepository> = {}): ScheduleRepository {
  return {
    findAllByTenant: vi.fn().mockResolvedValue([baseSchedule]),
    findById: vi.fn().mockResolvedValue(baseSchedule),
    create: vi.fn().mockResolvedValue(baseSchedule),
    update: vi.fn().mockResolvedValue(baseSchedule),
    deactivate: vi.fn().mockResolvedValue({ ...baseSchedule, status: 'inactive' }),
    findActiveByIds: vi.fn().mockResolvedValue(new Map()),
    ...overrides,
  } as unknown as ScheduleRepository;
}

describe('ScheduleService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: ScheduleService;

  beforeEach(() => {
    repo = makeRepo();
    service = new ScheduleService(repo);
  });

  it('lists schedules by tenant', async () => {
    const result = await service.listByTenant('tenant-1');
    expect(result).toEqual([baseSchedule]);
    expect(repo.findAllByTenant).toHaveBeenCalledWith('tenant-1');
  });

  it('gets schedule by id', async () => {
    const result = await service.getById('sched-1', 'tenant-1');
    expect(result).toEqual(baseSchedule);
  });

  it('throws ScheduleNotFoundError when not found', async () => {
    vi.mocked(repo.findById).mockResolvedValue(null);
    await expect(service.getById('missing', 'tenant-1')).rejects.toThrow(ScheduleNotFoundError);
  });

  it('creates a schedule with valid timezone', async () => {
    const result = await service.create({ tenant_id: 'tenant-1', name: 'My Schedule', timezone: 'UTC' });
    expect(result).toEqual(baseSchedule);
    expect(repo.create).toHaveBeenCalled();
  });

  it('rejects invalid timezone', async () => {
    await expect(service.create({ tenant_id: 'tenant-1', name: 'Bad', timezone: 'Not/A/Zone' })).rejects.toThrow(ScheduleValidationError);
  });

  it('rejects day_of_week out of range', async () => {
    await expect(
      service.create({
        tenant_id: 'tenant-1',
        name: 'Bad',
        timezone: 'UTC',
        weekly_rules_json: [{ day_of_week: 7 as never, open_time: '09:00', close_time: '17:00' }],
      }),
    ).rejects.toThrow(ScheduleValidationError);
  });

  it('rejects open_time >= close_time', async () => {
    await expect(
      service.create({
        tenant_id: 'tenant-1',
        name: 'Bad',
        timezone: 'UTC',
        weekly_rules_json: [{ day_of_week: 0, open_time: '17:00', close_time: '09:00' }],
      }),
    ).rejects.toThrow(ScheduleValidationError);
  });

  it('rejects invalid holiday override date format', async () => {
    await expect(
      service.create({
        tenant_id: 'tenant-1',
        name: 'Bad',
        timezone: 'UTC',
        holiday_overrides_json: [{ date: '2026/01/01', closed: true }],
      }),
    ).rejects.toThrow(ScheduleValidationError);
  });

  it('deactivates a schedule', async () => {
    const result = await service.deactivate('sched-1', 'tenant-1');
    expect(result.status).toBe('inactive');
  });

  it('throws when deactivating non-existent schedule', async () => {
    vi.mocked(repo.deactivate).mockResolvedValue(null);
    await expect(service.deactivate('missing', 'tenant-1')).rejects.toThrow(ScheduleNotFoundError);
  });

  it('updates a schedule successfully', async () => {
    const result = await service.update('sched-1', 'tenant-1', { name: 'Evening Hours' });
    expect(result).toEqual(baseSchedule);
    expect(repo.update).toHaveBeenCalled();
  });

  it('validates timezone during update', async () => {
    await expect(service.update('sched-1', 'tenant-1', { timezone: 'Bogus/Zone' })).rejects.toThrow(ScheduleValidationError);
  });

  it('validates weekly_rules_json during update', async () => {
    await expect(
      service.update('sched-1', 'tenant-1', {
        weekly_rules_json: [{ day_of_week: 8 as never, open_time: '09:00', close_time: '17:00' }],
      }),
    ).rejects.toThrow(ScheduleValidationError);
  });

  it('validates holiday_overrides_json during update', async () => {
    await expect(
      service.update('sched-1', 'tenant-1', {
        holiday_overrides_json: [{ date: 'bad-date', closed: true }],
      }),
    ).rejects.toThrow(ScheduleValidationError);
  });

  it('throws ScheduleNotFoundError when update returns null', async () => {
    vi.mocked(repo.update).mockResolvedValue(null);
    await expect(service.update('missing', 'tenant-1', { name: 'X' })).rejects.toThrow(ScheduleNotFoundError);
  });

  it('rejects non-array weekly_rules_json', async () => {
    await expect(
      service.create({
        tenant_id: 'tenant-1',
        name: 'Bad',
        timezone: 'UTC',
        weekly_rules_json: 'not-an-array' as never,
      }),
    ).rejects.toThrow(ScheduleValidationError);
  });

  it('rejects non-array holiday_overrides_json', async () => {
    await expect(
      service.create({
        tenant_id: 'tenant-1',
        name: 'Bad',
        timezone: 'UTC',
        holiday_overrides_json: {} as never,
      }),
    ).rejects.toThrow(ScheduleValidationError);
  });

  it('rejects open override missing open_time', async () => {
    await expect(
      service.create({
        tenant_id: 'tenant-1',
        name: 'Bad',
        timezone: 'UTC',
        holiday_overrides_json: [{ date: '2026-12-26', closed: false, close_time: '14:00' }],
      }),
    ).rejects.toThrow(ScheduleValidationError);
  });
});

const TENANT = 'tenant-1';
const SCHED_ID = 'sched-1';

function makeVersion(overrides: Partial<EnterpriseVersion> = {}): EnterpriseVersion {
  return { id: 'ver-1', tenant_id: TENANT, object_id: SCHED_ID, version_number: 1, state: 'draft', definition: {}, created_by: null, created_at: new Date(), validated_at: null, simulated_at: null, published_at: null, metadata: {}, ...overrides };
}

function makeLifecycle(overrides: Partial<EnterpriseLifecycleService> = {}): EnterpriseLifecycleService {
  const v = makeVersion();
  const publishResult: EnterprisePublishAttemptResult = { status: 'published', version: makeVersion({ state: 'published' }) };
  const dryRun: EnterpriseDryRunResult = { dry_run: true, would_become: 'published', require_approval: false, version_state_valid: true, actor_type: 'user' };
  return {
    createVersion: vi.fn().mockResolvedValue(v),
    listVersions: vi.fn().mockResolvedValue([v]),
    validate: vi.fn().mockImplementation(async (_ot, _oid, _vid, _tid, validatorFn) => { const outcome = await validatorFn(v); return { version: v, outcome }; }),
    simulate: vi.fn().mockImplementation(async (_ot, _oid, _vid, _tid, _sc, simFn) => { const outcome = await simFn(v, {}); return { version: v, outcome }; }),
    dryRunPublish: vi.fn().mockResolvedValue(dryRun),
    publish: vi.fn().mockResolvedValue(publishResult),
    rollback: vi.fn().mockResolvedValue(publishResult),
    ...overrides,
  } as unknown as EnterpriseLifecycleService;
}

function makeScheduleRepo(overrides: Partial<ScheduleRepository> = {}): ScheduleRepository {
  return {
    findAllByTenant: vi.fn().mockResolvedValue([baseSchedule]),
    findById: vi.fn().mockResolvedValue(baseSchedule),
    create: vi.fn().mockResolvedValue(baseSchedule),
    update: vi.fn().mockResolvedValue(baseSchedule),
    deactivate: vi.fn().mockResolvedValue({ ...baseSchedule, status: 'inactive' }),
    findActiveByIds: vi.fn().mockResolvedValue(new Map()),
    ...overrides,
  } as unknown as ScheduleRepository;
}

describe('ScheduleService — lifecycle', () => {
  it('createVersion delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new ScheduleService(makeScheduleRepo(), lc);
    await svc.createVersion(SCHED_ID, TENANT, { x: 1 }, 'user-1');
    expect(lc.createVersion).toHaveBeenCalledWith('schedule', SCHED_ID, TENANT, { x: 1 }, 'user-1', undefined);
  });

  it('listVersions delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new ScheduleService(makeScheduleRepo(), lc);
    const result = await svc.listVersions(SCHED_ID, TENANT);
    expect(result).toHaveLength(1);
  });

  it('validate passes when schedule has valid timezone and rules', async () => {
    const lc = makeLifecycle();
    const svc = new ScheduleService(makeScheduleRepo(), lc);
    const result = await svc.validate(SCHED_ID, 'ver-1', TENANT);
    expect(result.outcome.status).toBe('passed');
  });

  it('validate fails when schedule has invalid timezone', async () => {
    const lc = makeLifecycle();
    const invalidSched = { ...baseSchedule, timezone: 'Invalid/Zone' };
    const svc = new ScheduleService(makeScheduleRepo({ findById: vi.fn().mockResolvedValue(invalidSched) }), lc);
    const result = await svc.validate(SCHED_ID, 'ver-1', TENANT);
    expect(result.outcome.status).toBe('failed');
    expect(result.outcome.errors.some(e => e.field === 'timezone')).toBe(true);
  });

  it('validate throws ScheduleNotFoundError when schedule missing', async () => {
    const lc = makeLifecycle();
    const svc = new ScheduleService(makeScheduleRepo({ findById: vi.fn().mockResolvedValue(null) }), lc);
    await expect(svc.validate('missing', 'ver-1', TENANT)).rejects.toBeInstanceOf(ScheduleNotFoundError);
  });

  it('simulate delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new ScheduleService(makeScheduleRepo(), lc);
    const result = await svc.simulate(SCHED_ID, 'ver-1', TENANT, '2026-06-07T09:00:00Z');
    expect(result.outcome).toMatchObject({ status: 'passed' });
  });

  it('simulate throws ScheduleNotFoundError when schedule missing', async () => {
    const lc = makeLifecycle();
    const svc = new ScheduleService(makeScheduleRepo({ findById: vi.fn().mockResolvedValue(null) }), lc);
    await expect(svc.simulate('missing', 'ver-1', TENANT, '2026-06-07T09:00:00Z')).rejects.toBeInstanceOf(ScheduleNotFoundError);
  });

  it('dryRunPublish delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new ScheduleService(makeScheduleRepo(), lc);
    const result = await svc.dryRunPublish(SCHED_ID, 'ver-1', TENANT);
    expect(result.would_become).toBe('published');
  });

  it('publish delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new ScheduleService(makeScheduleRepo(), lc);
    const result = await svc.publish(SCHED_ID, 'ver-1', TENANT, 'user-1');
    expect(result.status).toBe('published');
  });

  it('rollback delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new ScheduleService(makeScheduleRepo(), lc);
    const result = await svc.rollback(SCHED_ID, TENANT, 'user-1');
    expect(result.status).toBe('published');
  });

  it('lifecycle getter throws when lifecycleSvc not provided', async () => {
    const svc = new ScheduleService(makeScheduleRepo());
    expect(() => svc.createVersion(SCHED_ID, TENANT, {})).toThrow('EnterpriseLifecycleService not provided');
  });
});
