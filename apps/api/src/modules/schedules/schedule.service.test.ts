import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HolidayCalendarNotFoundError,
  ScheduleNotFoundError,
  ScheduleOverrideNotFoundError,
  ScheduleService,
  ScheduleValidationError,
} from './schedule.service.js';
import type { ScheduleRepository } from './schedule.repository.js';
import type { Schedule } from './schedule.types.js';

const baseSchedule: Schedule = {
  id: 'sched-1',
  tenant_id: 'tenant-1',
  name: 'Business Hours',
  description: null,
  status: 'active',
  timezone: 'America/New_York',
  weekly_rules_json: [{ day_of_week: 1, open_time: '09:00', close_time: '17:00' }],
  holiday_overrides_json: [],
  holiday_calendars: [],
  temporary_overrides: [],
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
    listHolidayCalendars: vi.fn().mockResolvedValue([]),
    createHolidayCalendar: vi.fn().mockResolvedValue({
      id: 'cal-1',
      tenant_id: 'tenant-1',
      schedule_id: 'sched-1',
      name: 'US Holidays',
      description: null,
      status: 'active',
      entries_json: [{ date: '2026-12-25', closed: true }],
      created_at: new Date(),
      updated_at: new Date(),
    }),
    updateHolidayCalendar: vi.fn().mockResolvedValue({
      id: 'cal-1',
      tenant_id: 'tenant-1',
      schedule_id: 'sched-1',
      name: 'US Holidays',
      description: null,
      status: 'inactive',
      entries_json: [{ date: '2026-12-25', closed: true }],
      created_at: new Date(),
      updated_at: new Date(),
    }),
    findHolidayCalendarById: vi.fn().mockResolvedValue(null),
    createScheduleOverride: vi.fn().mockResolvedValue({
      id: 'ovr-1',
      tenant_id: 'tenant-1',
      schedule_id: 'sched-1',
      name: 'Storm closure',
      reason: 'weather',
      status: 'active',
      starts_at: new Date('2026-01-05T13:00:00.000Z'),
      ends_at: new Date('2026-01-05T23:00:00.000Z'),
      closed: true,
      open_time: null,
      close_time: null,
      cancelled_at: null,
      cancelled_by: null,
      created_by: 'user-1',
      created_at: new Date(),
      updated_at: new Date(),
    }),
    updateScheduleOverride: vi.fn().mockResolvedValue({
      id: 'ovr-1',
      tenant_id: 'tenant-1',
      schedule_id: 'sched-1',
      name: 'Storm closure',
      reason: 'weather',
      status: 'active',
      starts_at: new Date('2026-01-05T13:00:00.000Z'),
      ends_at: new Date('2026-01-05T23:00:00.000Z'),
      closed: true,
      open_time: null,
      close_time: null,
      cancelled_at: null,
      cancelled_by: null,
      created_by: 'user-1',
      created_at: new Date(),
      updated_at: new Date(),
    }),
    cancelScheduleOverride: vi.fn().mockResolvedValue({
      id: 'ovr-1',
      tenant_id: 'tenant-1',
      schedule_id: 'sched-1',
      name: 'Storm closure',
      reason: 'weather',
      status: 'cancelled',
      starts_at: new Date('2026-01-05T13:00:00.000Z'),
      ends_at: new Date('2026-01-05T23:00:00.000Z'),
      closed: true,
      open_time: null,
      close_time: null,
      cancelled_at: new Date(),
      cancelled_by: 'user-1',
      created_by: 'user-1',
      created_at: new Date(),
      updated_at: new Date(),
    }),
    listScheduleOverrides: vi.fn().mockResolvedValue([]),
    findScheduleOverrideById: vi.fn().mockResolvedValue({
      id: 'ovr-1',
      tenant_id: 'tenant-1',
      schedule_id: 'sched-1',
      name: 'Storm closure',
      reason: 'weather',
      status: 'active',
      starts_at: new Date('2026-01-05T13:00:00.000Z'),
      ends_at: new Date('2026-01-05T23:00:00.000Z'),
      closed: true,
      open_time: null,
      close_time: null,
      cancelled_at: null,
      cancelled_by: null,
      created_by: 'user-1',
      created_at: new Date(),
      updated_at: new Date(),
    }),
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

  it('creates a holiday calendar with unique dates', async () => {
    const result = await service.createHolidayCalendar({
      tenant_id: 'tenant-1',
      schedule_id: 'sched-1',
      name: 'US Holidays',
      entries_json: [{ date: '2026-12-25', closed: true }],
    });
    expect(result.id).toBe('cal-1');
    expect(repo.createHolidayCalendar).toHaveBeenCalled();
  });

  it('rejects holiday calendar dates that duplicate legacy overrides', async () => {
    vi.mocked(repo.findById).mockResolvedValue({
      ...baseSchedule,
      holiday_overrides_json: [{ date: '2026-12-25', closed: true }],
    });
    await expect(
      service.createHolidayCalendar({
        tenant_id: 'tenant-1',
        schedule_id: 'sched-1',
        name: 'Dupes',
        entries_json: [{ date: '2026-12-25', closed: true }],
      }),
    ).rejects.toThrow(ScheduleValidationError);
  });

  it('throws when holiday calendar update target is missing', async () => {
    vi.mocked(repo.updateHolidayCalendar).mockResolvedValue(null);
    await expect(
      service.updateHolidayCalendar('missing', 'sched-1', 'tenant-1', { name: 'x' }),
    ).rejects.toThrow(HolidayCalendarNotFoundError);
  });

  it('creates a temporary override with valid expiry window', async () => {
    const result = await service.createScheduleOverride({
      tenant_id: 'tenant-1',
      schedule_id: 'sched-1',
      name: 'Storm closure',
      starts_at: '2026-01-05T13:00:00.000Z',
      ends_at: '2026-01-05T23:00:00.000Z',
      closed: true,
    });
    expect(result.id).toBe('ovr-1');
    expect(repo.createScheduleOverride).toHaveBeenCalled();
  });

  it('rejects a temporary override with inverted expiry window', async () => {
    await expect(
      service.createScheduleOverride({
        tenant_id: 'tenant-1',
        schedule_id: 'sched-1',
        name: 'Broken',
        starts_at: '2026-01-05T23:00:00.000Z',
        ends_at: '2026-01-05T13:00:00.000Z',
        closed: true,
      }),
    ).rejects.toThrow(ScheduleValidationError);
  });

  it('throws when schedule override update target is missing', async () => {
    vi.mocked(repo.findScheduleOverrideById).mockResolvedValue(null);
    await expect(
      service.updateScheduleOverride('missing', 'sched-1', 'tenant-1', { name: 'x' }),
    ).rejects.toThrow(ScheduleOverrideNotFoundError);
  });

  it('cancels a temporary override', async () => {
    const result = await service.cancelScheduleOverride('ovr-1', 'sched-1', 'tenant-1', 'user-1');
    expect(result.status).toBe('cancelled');
    expect(repo.cancelScheduleOverride).toHaveBeenCalledWith('ovr-1', 'sched-1', 'tenant-1', 'user-1');
  });
});
