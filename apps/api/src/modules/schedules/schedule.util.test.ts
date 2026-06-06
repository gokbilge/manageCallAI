import { describe, it, expect } from 'vitest';
import { isInBusinessHours } from './schedule.util.js';
import type { HolidayOverride, WeeklyRule } from './schedule.types.js';

const MON_09_30_NY = new Date('2026-01-05T14:30:00.000Z'); // Monday 09:30 AM Eastern (UTC-5 in Jan)
const MON_17_30_NY = new Date('2026-01-05T22:30:00.000Z'); // Monday 17:30 Eastern (closed)
const SAT_11_00_NY = new Date('2026-01-10T16:00:00.000Z'); // Saturday 11:00 Eastern (no rule)

const weekdaySchedule = {
  timezone: 'America/New_York',
  weekly_rules_json: [
    { day_of_week: 1 as WeeklyRule['day_of_week'], open_time: '09:00', close_time: '17:00' },
    { day_of_week: 2 as WeeklyRule['day_of_week'], open_time: '09:00', close_time: '17:00' },
    { day_of_week: 3 as WeeklyRule['day_of_week'], open_time: '09:00', close_time: '17:00' },
    { day_of_week: 4 as WeeklyRule['day_of_week'], open_time: '09:00', close_time: '17:00' },
    { day_of_week: 5 as WeeklyRule['day_of_week'], open_time: '09:00', close_time: '17:00' },
  ],
  holiday_overrides_json: [] as HolidayOverride[],
  holiday_calendars: [],
  temporary_overrides: [],
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

  it('respects a closed holiday override', () => {
    const schedule = {
      ...weekdaySchedule,
      holiday_overrides_json: [{ date: '2026-01-05', closed: true }] as HolidayOverride[],
    };
    expect(isInBusinessHours(schedule, MON_09_30_NY)).toBe(false);
  });

  it('respects an open holiday override with custom hours', () => {
    const schedule = {
      ...weekdaySchedule,
      holiday_overrides_json: [{ date: '2026-01-05', closed: false, open_time: '10:00', close_time: '14:00' }] as HolidayOverride[],
    };
    expect(isInBusinessHours(schedule, MON_09_30_NY)).toBe(false);
    const MON_11_00_NY = new Date('2026-01-05T16:00:00.000Z');
    expect(isInBusinessHours(schedule, MON_11_00_NY)).toBe(true);
  });

  it('returns false on malformed (non-closed) override with no times', () => {
    const schedule = {
      ...weekdaySchedule,
      holiday_overrides_json: [{ date: '2026-01-05', closed: false }] as HolidayOverride[],
    };
    expect(isInBusinessHours(schedule, MON_09_30_NY)).toBe(false);
  });

  it('handles UTC timezone correctly', () => {
    const utcSchedule = {
      timezone: 'UTC',
      weekly_rules_json: [{ day_of_week: 1 as WeeklyRule['day_of_week'], open_time: '09:00', close_time: '17:00' }],
      holiday_overrides_json: [] as HolidayOverride[],
      holiday_calendars: [],
      temporary_overrides: [],
    };
    const MON_10_00_UTC = new Date('2026-01-05T10:00:00.000Z');
    expect(isInBusinessHours(utcSchedule, MON_10_00_UTC)).toBe(true);
  });

  it('returns false for invalid timezone', () => {
    const schedule = {
      timezone: 'Not/Valid',
      weekly_rules_json: [{ day_of_week: 1 as WeeklyRule['day_of_week'], open_time: '09:00', close_time: '17:00' }],
      holiday_overrides_json: [] as HolidayOverride[],
      holiday_calendars: [],
      temporary_overrides: [],
    };
    expect(isInBusinessHours(schedule, MON_09_30_NY)).toBe(false);
  });

  it('prefers an active temporary closure override over weekly hours', () => {
    const schedule = {
      ...weekdaySchedule,
      temporary_overrides: [
        {
          id: 'override-1',
          tenant_id: 'tenant-1',
          schedule_id: 'sched-1',
          name: 'Snow day',
          reason: 'weather',
          status: 'active' as const,
          starts_at: new Date('2026-01-05T13:00:00.000Z'),
          ends_at: new Date('2026-01-05T23:00:00.000Z'),
          closed: true,
          open_time: null,
          close_time: null,
          cancelled_at: null,
          cancelled_by: null,
          created_by: null,
          created_at: new Date('2026-01-01T00:00:00.000Z'),
          updated_at: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    };
    expect(isInBusinessHours(schedule, MON_09_30_NY)).toBe(false);
  });

  it('evaluates an active temporary custom-hours override before holiday calendars', () => {
    const schedule = {
      ...weekdaySchedule,
      holiday_calendars: [
        {
          id: 'cal-1',
          tenant_id: 'tenant-1',
          schedule_id: 'sched-1',
          name: 'Closures',
          description: null,
          status: 'active' as const,
          entries_json: [{ date: '2026-01-05', closed: true }],
          created_at: new Date('2026-01-01T00:00:00.000Z'),
          updated_at: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      temporary_overrides: [
        {
          id: 'override-1',
          tenant_id: 'tenant-1',
          schedule_id: 'sched-1',
          name: 'Open late',
          reason: null,
          status: 'active' as const,
          starts_at: new Date('2026-01-05T13:00:00.000Z'),
          ends_at: new Date('2026-01-05T23:00:00.000Z'),
          closed: false,
          open_time: '09:00',
          close_time: '12:00',
          cancelled_at: null,
          cancelled_by: null,
          created_by: null,
          created_at: new Date('2026-01-01T00:00:00.000Z'),
          updated_at: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    };
    expect(isInBusinessHours(schedule, MON_09_30_NY)).toBe(true);
  });

  it('uses active holiday calendars before legacy holiday overrides', () => {
    const schedule = {
      ...weekdaySchedule,
      holiday_overrides_json: [{ date: '2026-01-05', closed: false, open_time: '10:00', close_time: '14:00' }] as HolidayOverride[],
      holiday_calendars: [
        {
          id: 'cal-1',
          tenant_id: 'tenant-1',
          schedule_id: 'sched-1',
          name: 'Closures',
          description: null,
          status: 'active' as const,
          entries_json: [{ date: '2026-01-05', closed: true }],
          created_at: new Date('2026-01-01T00:00:00.000Z'),
          updated_at: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      temporary_overrides: [],
    };
    expect(isInBusinessHours(schedule, MON_09_30_NY)).toBe(false);
  });
});
