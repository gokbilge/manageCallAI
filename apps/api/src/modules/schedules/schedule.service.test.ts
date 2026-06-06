import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduleRepository } from './schedule.repository.js';
import {
  HolidayCalendarNotFoundError,
  ScheduleConflictError,
  ScheduleGroupNotFoundError,
  ScheduleNotFoundError,
  ScheduleOverrideNotFoundError,
  ScheduleService,
  ScheduleValidationError,
} from './schedule.service.js';
import type {
  HolidayCalendar,
  Schedule,
  ScheduleGroup,
  ScheduleOverrideRecord,
} from './schedule.types.js';

const baseSchedule: Schedule = {
  id: '11111111-1111-1111-1111-111111111111',
  tenant_id: 'tenant-1',
  name: 'Business Hours',
  status: 'active',
  timezone: 'America/New_York',
  schedule_group_id: null,
  holiday_calendar_id: null,
  weekly_rules_json: [{ day_of_week: 1, open_time: '09:00', close_time: '17:00' }],
  holiday_overrides_json: [],
  created_at: new Date(),
  updated_at: new Date(),
};

const baseGroup: ScheduleGroup = {
  id: '22222222-2222-2222-2222-222222222222',
  tenant_id: 'tenant-1',
  name: 'Weekday Core',
  description: null,
  status: 'active',
  weekly_rules_json: [{ day_of_week: 1, open_time: '08:00', close_time: '18:00' }],
  created_at: new Date(),
  updated_at: new Date(),
};

const baseCalendar: HolidayCalendar = {
  id: '33333333-3333-3333-3333-333333333333',
  tenant_id: 'tenant-1',
  name: 'US Holidays',
  description: null,
  status: 'active',
  entries_json: [{ date: '2026-12-25', closed: true, name: 'Christmas' }],
  created_at: new Date(),
  updated_at: new Date(),
};

const baseOverride: ScheduleOverrideRecord = {
  id: '44444444-4444-4444-4444-444444444444',
  tenant_id: 'tenant-1',
  schedule_id: baseSchedule.id,
  name: 'Storm closure',
  reason: 'weather',
  mode: 'closed',
  open_time: null,
  close_time: null,
  starts_at: new Date('2026-06-10T10:00:00.000Z'),
  ends_at: new Date('2026-06-10T14:00:00.000Z'),
  cancelled_at: null,
  cancelled_by: null,
  created_by: 'user-1',
  created_at: new Date('2026-06-10T09:00:00.000Z'),
  updated_at: new Date('2026-06-10T09:00:00.000Z'),
};

function makeRepo(overrides: Partial<ScheduleRepository> = {}): ScheduleRepository {
  return {
    findAllByTenant: vi.fn().mockResolvedValue([baseSchedule]),
    findById: vi.fn().mockResolvedValue(baseSchedule),
    create: vi.fn().mockResolvedValue(baseSchedule),
    update: vi.fn().mockResolvedValue(baseSchedule),
    deactivate: vi.fn().mockResolvedValue({ ...baseSchedule, status: 'inactive' }),
    findActiveByIds: vi.fn().mockResolvedValue(new Map()),
    findScheduleGroupById: vi.fn().mockResolvedValue(baseGroup),
    findAllScheduleGroupsByTenant: vi.fn().mockResolvedValue([baseGroup]),
    createScheduleGroup: vi.fn().mockResolvedValue(baseGroup),
    updateScheduleGroup: vi.fn().mockResolvedValue(baseGroup),
    syncSchedulesForGroup: vi.fn().mockResolvedValue(undefined),
    findHolidayCalendarById: vi.fn().mockResolvedValue(baseCalendar),
    findAllHolidayCalendarsByTenant: vi.fn().mockResolvedValue([baseCalendar]),
    createHolidayCalendar: vi.fn().mockResolvedValue(baseCalendar),
    updateHolidayCalendar: vi.fn().mockResolvedValue(baseCalendar),
    syncSchedulesForHolidayCalendar: vi.fn().mockResolvedValue(undefined),
    findOverridesBySchedule: vi.fn().mockResolvedValue([baseOverride]),
    findOverrideById: vi.fn().mockResolvedValue(baseOverride),
    findOverlappingOverrides: vi.fn().mockResolvedValue([]),
    createOverride: vi.fn().mockResolvedValue(baseOverride),
    cancelOverride: vi.fn().mockResolvedValue({ ...baseOverride, cancelled_at: new Date('2026-06-10T09:30:00.000Z'), cancelled_by: 'user-1' }),
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
    await expect(service.listByTenant('tenant-1')).resolves.toEqual([baseSchedule]);
  });

  it('creates a schedule from schedule group and holiday calendar snapshots', async () => {
    await service.create({
      tenant_id: 'tenant-1',
      name: 'Ops schedule',
      timezone: 'UTC',
      schedule_group_id: baseGroup.id,
      holiday_calendar_id: baseCalendar.id,
    });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      schedule_group_id: baseGroup.id,
      holiday_calendar_id: baseCalendar.id,
      weekly_rules_json: baseGroup.weekly_rules_json,
      holiday_overrides_json: baseCalendar.entries_json,
    }));
  });

  it('rejects mixing schedule group ids with inline weekly rules', async () => {
    await expect(service.create({
      tenant_id: 'tenant-1',
      name: 'Bad',
      timezone: 'UTC',
      schedule_group_id: baseGroup.id,
      weekly_rules_json: [],
    })).rejects.toThrow(ScheduleValidationError);
  });

  it('throws when referenced schedule group is missing', async () => {
    vi.mocked(repo.findScheduleGroupById).mockResolvedValue(null);
    await expect(service.create({
      tenant_id: 'tenant-1',
      name: 'Bad',
      timezone: 'UTC',
      schedule_group_id: baseGroup.id,
    })).rejects.toThrow(ScheduleGroupNotFoundError);
  });

  it('updates a schedule group and syncs linked schedules', async () => {
    const rules = [{ day_of_week: 2, open_time: '09:00', close_time: '19:00' }];
    const result = await service.updateGroup(baseGroup.id, 'tenant-1', { weekly_rules_json: rules });
    expect(result).toEqual(baseGroup);
    expect(repo.syncSchedulesForGroup).toHaveBeenCalledWith(baseGroup.id, 'tenant-1', rules);
  });

  it('updates a holiday calendar and syncs linked schedules', async () => {
    const entries = [{ date: '2026-12-31', closed: false, open_time: '10:00', close_time: '13:00' }];
    const result = await service.updateHolidayCalendar(baseCalendar.id, 'tenant-1', { entries_json: entries });
    expect(result).toEqual(baseCalendar);
    expect(repo.syncSchedulesForHolidayCalendar).toHaveBeenCalledWith(baseCalendar.id, 'tenant-1', entries);
  });

  it('lists schedule overrides with computed lifecycle state', async () => {
    const result = await service.listOverrides(baseSchedule.id, 'tenant-1');
    expect(result[0]?.lifecycle_state).toBe('scheduled');
  });

  it('creates a temporary override when there is no overlap', async () => {
    const result = await service.createOverride({
      tenant_id: 'tenant-1',
      schedule_id: baseSchedule.id,
      name: 'One-time closure',
      mode: 'closed',
      starts_at: '2026-06-10T10:00:00.000Z',
      ends_at: '2026-06-10T12:00:00.000Z',
      created_by: 'user-1',
    });
    expect(result.id).toBe(baseOverride.id);
    expect(repo.createOverride).toHaveBeenCalled();
  });

  it('rejects overlapping active or scheduled overrides', async () => {
    vi.mocked(repo.findOverlappingOverrides).mockResolvedValue([baseOverride]);
    await expect(service.createOverride({
      tenant_id: 'tenant-1',
      schedule_id: baseSchedule.id,
      name: 'Overlap',
      mode: 'closed',
      starts_at: '2026-06-10T10:30:00.000Z',
      ends_at: '2026-06-10T11:30:00.000Z',
      created_by: 'user-1',
    })).rejects.toThrow(ScheduleConflictError);
  });

  it('rejects malformed custom-hours overrides', async () => {
    await expect(service.createOverride({
      tenant_id: 'tenant-1',
      schedule_id: baseSchedule.id,
      name: 'Bad',
      mode: 'custom_hours',
      open_time: '18:00',
      close_time: '09:00',
      starts_at: '2026-06-10T10:00:00.000Z',
      ends_at: '2026-06-10T12:00:00.000Z',
      created_by: 'user-1',
    })).rejects.toThrow(ScheduleValidationError);
  });

  it('cancels an override and returns cancelled lifecycle state', async () => {
    const result = await service.cancelOverride(baseSchedule.id, baseOverride.id, 'tenant-1', { cancelled_by: 'user-1' });
    expect(result.lifecycle_state).toBe('cancelled');
    expect(repo.cancelOverride).toHaveBeenCalledWith(baseOverride.id, baseSchedule.id, 'tenant-1', { cancelled_by: 'user-1' });
  });

  it('throws when cancelling a missing override', async () => {
    vi.mocked(repo.findOverrideById).mockResolvedValue(null);
    await expect(service.cancelOverride(baseSchedule.id, 'missing', 'tenant-1', { cancelled_by: 'user-1' })).rejects.toThrow(ScheduleOverrideNotFoundError);
  });

  it('throws when schedule update target does not exist', async () => {
    vi.mocked(repo.update).mockResolvedValue(null);
    await expect(service.update(baseSchedule.id, 'tenant-1', { name: 'X' })).rejects.toThrow(ScheduleNotFoundError);
  });

  it('rejects invalid holiday calendar dates', async () => {
    await expect(service.createHolidayCalendar({
      tenant_id: 'tenant-1',
      name: 'Bad',
      entries_json: [{ date: '2026/12/31', closed: true }],
    })).rejects.toThrow(ScheduleValidationError);
  });

  it('throws when holiday calendar reference is missing during schedule update', async () => {
    vi.mocked(repo.findHolidayCalendarById).mockResolvedValue(null);
    await expect(service.update(baseSchedule.id, 'tenant-1', { holiday_calendar_id: baseCalendar.id })).rejects.toThrow(HolidayCalendarNotFoundError);
  });
});
