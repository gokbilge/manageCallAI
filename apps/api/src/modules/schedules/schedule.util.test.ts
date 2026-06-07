import { describe, it, expect } from 'vitest';
import { isInBusinessHours } from './schedule.util.js';
import type { HolidayCalendarEntry, ScheduleOverride, WeeklyRule } from './schedule.types.js';

const MON_09_30_NY = new Date('2026-01-05T14:30:00.000Z');
const MON_11_00_NY = new Date('2026-01-05T16:00:00.000Z');
const MON_17_30_NY = new Date('2026-01-05T22:30:00.000Z');
const SAT_11_00_NY = new Date('2026-01-10T16:00:00.000Z');

const weekdaySchedule = {
  timezone: 'America/New_York',
  weekly_rules_json: [
    { day_of_week: 1 as WeeklyRule['day_of_week'], open_time: '09:00', close_time: '17:00' },
    { day_of_week: 2 as WeeklyRule['day_of_week'], open_time: '09:00', close_time: '17:00' },
    { day_of_week: 3 as WeeklyRule['day_of_week'], open_time: '09:00', close_time: '17:00' },
    { day_of_week: 4 as WeeklyRule['day_of_week'], open_time: '09:00', close_time: '17:00' },
    { day_of_week: 5 as WeeklyRule['day_of_week'], open_time: '09:00', close_time: '17:00' },
  ],
  holiday_calendar_json: [] as HolidayCalendarEntry[],
  override_windows_json: [] as ScheduleOverride[],
};

describe('isInBusinessHours', () => {
  it('returns true during open hours on a weekday', () => {
    expect(isInBusinessHours(weekdaySchedule, MON_09_30_NY)).toBe(true);
  });

  it('returns false after close time', () => {
    expect(isInBusinessHours(weekdaySchedule, MON_17_30_NY)).toBe(false);
  });

  it('returns false on Saturday with no rule', () => {
    expect(isInBusinessHours(weekdaySchedule, SAT_11_00_NY)).toBe(false);
  });

  it('respects a closed holiday calendar entry', () => {
    const schedule = {
      ...weekdaySchedule,
      holiday_calendar_json: [{ date: '2026-01-05', name: 'Observed holiday', closed: true }] as HolidayCalendarEntry[],
    };
    expect(isInBusinessHours(schedule, MON_09_30_NY)).toBe(false);
  });

  it('respects a holiday calendar entry with custom hours', () => {
    const schedule = {
      ...weekdaySchedule,
      holiday_calendar_json: [{ date: '2026-01-05', name: 'Short day', closed: false, open_time: '10:00', close_time: '14:00' }] as HolidayCalendarEntry[],
    };
    expect(isInBusinessHours(schedule, MON_09_30_NY)).toBe(false);
    expect(isInBusinessHours(schedule, MON_11_00_NY)).toBe(true);
  });

  it('lets an active closed override take precedence over weekly rules', () => {
    const schedule = {
      ...weekdaySchedule,
      override_windows_json: [{
        id: 'override-1',
        name: 'Emergency closure',
        reason: 'Weather',
        starts_at: '2026-01-05T13:00:00.000Z',
        ends_at: '2026-01-05T18:00:00.000Z',
        mode: 'closed' as const,
        status: 'active' as const,
        created_by_user_id: 'user-1',
        created_at: '2026-01-05T12:00:00.000Z',
        revoked_by_user_id: null,
        revoked_at: null,
      }],
    };
    expect(isInBusinessHours(schedule, MON_09_30_NY)).toBe(false);
  });

  it('lets an active custom-hours override take precedence over the holiday calendar', () => {
    const schedule = {
      ...weekdaySchedule,
      holiday_calendar_json: [{ date: '2026-01-05', name: 'Closed holiday', closed: true }] as HolidayCalendarEntry[],
      override_windows_json: [{
        id: 'override-1',
        name: 'Emergency reopen',
        reason: null,
        starts_at: '2026-01-05T13:00:00.000Z',
        ends_at: '2026-01-05T18:00:00.000Z',
        mode: 'custom_hours' as const,
        open_time: '09:00',
        close_time: '12:00',
        status: 'active' as const,
        created_by_user_id: 'user-1',
        created_at: '2026-01-05T12:00:00.000Z',
        revoked_by_user_id: null,
        revoked_at: null,
      }],
    };
    expect(isInBusinessHours(schedule, MON_11_00_NY)).toBe(true);
  });

  it('ignores revoked overrides', () => {
    const schedule = {
      ...weekdaySchedule,
      override_windows_json: [{
        id: 'override-1',
        name: 'Revoked closure',
        reason: null,
        starts_at: '2026-01-05T13:00:00.000Z',
        ends_at: '2026-01-05T18:00:00.000Z',
        mode: 'closed' as const,
        status: 'revoked' as const,
        created_by_user_id: 'user-1',
        created_at: '2026-01-05T12:00:00.000Z',
        revoked_by_user_id: 'user-2',
        revoked_at: '2026-01-05T12:30:00.000Z',
      }],
    };
    expect(isInBusinessHours(schedule, MON_11_00_NY)).toBe(true);
  });

  it('returns false for invalid timezone', () => {
    const schedule = {
      timezone: 'Not/Valid',
      weekly_rules_json: [{ day_of_week: 1 as WeeklyRule['day_of_week'], open_time: '09:00', close_time: '17:00' }],
      holiday_calendar_json: [] as HolidayCalendarEntry[],
      override_windows_json: [] as ScheduleOverride[],
    };
    expect(isInBusinessHours(schedule, MON_09_30_NY)).toBe(false);
  });
});
