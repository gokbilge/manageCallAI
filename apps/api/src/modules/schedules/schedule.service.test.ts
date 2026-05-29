import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduleService, ScheduleNotFoundError, ScheduleValidationError } from './schedule.service.js';
import type { ScheduleRepository } from './schedule.repository.js';
import type { Schedule } from './schedule.types.js';

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
});
