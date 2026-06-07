import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { ScheduleRepository } from './schedule.repository.js';
import type { Schedule, ScheduleOverride } from './schedule.types.js';

const TENANT = 'tenant-1';
const SCHEDULE_ID = 'sched-1';

const base: Schedule = {
  id: SCHEDULE_ID,
  tenant_id: TENANT,
  name: 'Business Hours',
  status: 'active',
  description: 'Mon-Fri 9-5',
  timezone: 'America/New_York',
  weekly_rules_json: [{ day_of_week: 1, open_time: '09:00', close_time: '17:00' }],
  holiday_calendar_name: 'US Holidays',
  holiday_calendar_json: [{ date: '2026-12-25', name: 'Christmas', closed: true }],
  override_windows_json: [],
  created_at: new Date(),
  updated_at: new Date(),
};

function makePool(rows: unknown[] = []): Pool {
  return { query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }) } as unknown as Pool;
}

describe('ScheduleRepository', () => {
  it('findAllByTenant returns all schedules', async () => {
    const pool = makePool([base]);
    expect(await new ScheduleRepository(pool).findAllByTenant(TENANT)).toHaveLength(1);
  });

  it('findById returns schedule when found', async () => {
    const pool = makePool([base]);
    expect((await new ScheduleRepository(pool).findById(SCHEDULE_ID, TENANT))?.name).toBe('Business Hours');
  });

  it('findById returns null when not found', async () => {
    const pool = makePool([]);
    expect(await new ScheduleRepository(pool).findById('missing', TENANT)).toBeNull();
  });

  it('create inserts schedule and returns it', async () => {
    const pool = makePool([base]);
    const result = await new ScheduleRepository(pool).create({
      tenant_id: TENANT,
      name: 'Business Hours',
      timezone: 'America/New_York',
      weekly_rules_json: [{ day_of_week: 1, open_time: '09:00', close_time: '17:00' }],
      holiday_calendar_name: 'US Holidays',
      holiday_calendar_json: [{ date: '2026-12-25', name: 'Christmas', closed: true }],
    });
    expect(result.timezone).toBe('America/New_York');
  });

  it('create with minimal fields uses defaults', async () => {
    const pool = makePool([{ ...base, description: null, holiday_calendar_name: null }]);
    const result = await new ScheduleRepository(pool).create({
      tenant_id: TENANT,
      name: 'Minimal',
      timezone: 'UTC',
    });
    expect(result.name).toBe('Business Hours');
  });

  it('update with name returns updated schedule', async () => {
    const updated = { ...base, name: 'After Hours' };
    const pool = makePool([updated]);
    const result = await new ScheduleRepository(pool).update(SCHEDULE_ID, TENANT, { name: 'After Hours' });
    expect(result?.name).toBe('After Hours');
  });

  it('update with all fields sends full SET clause', async () => {
    const updated = { ...base, timezone: 'UTC', status: 'inactive' as const };
    const pool = makePool([updated]);
    const result = await new ScheduleRepository(pool).update(SCHEDULE_ID, TENANT, {
      name: 'Updated',
      description: 'new desc',
      timezone: 'UTC',
      status: 'inactive',
      weekly_rules_json: [],
      holiday_calendar_name: 'Holidays',
      holiday_calendar_json: [],
    });
    expect(result?.timezone).toBe('UTC');
  });

  it('update with no fields calls findById', async () => {
    const pool = makePool([base]);
    const result = await new ScheduleRepository(pool).update(SCHEDULE_ID, TENANT, {});
    expect(result?.id).toBe(SCHEDULE_ID);
  });

  it('update returns null when not found', async () => {
    const pool = makePool([]);
    expect(await new ScheduleRepository(pool).update('missing', TENANT, { name: 'X' })).toBeNull();
  });

  it('deactivate returns updated schedule', async () => {
    const deactivated = { ...base, status: 'inactive' as const };
    const pool = makePool([deactivated]);
    const result = await new ScheduleRepository(pool).deactivate(SCHEDULE_ID, TENANT);
    expect(result?.status).toBe('inactive');
  });

  it('deactivate returns null when not found', async () => {
    const pool = makePool([]);
    expect(await new ScheduleRepository(pool).deactivate('missing', TENANT)).toBeNull();
  });

  it('findActiveByIds returns empty map for empty ids', async () => {
    const pool = makePool([]);
    const result = await new ScheduleRepository(pool).findActiveByIds(TENANT, []);
    expect(result.size).toBe(0);
  });

  it('findActiveByIds returns map keyed by id', async () => {
    const pool = makePool([base]);
    const result = await new ScheduleRepository(pool).findActiveByIds(TENANT, [SCHEDULE_ID]);
    expect(result.get(SCHEDULE_ID)?.name).toBe('Business Hours');
  });

  it('replaceOverrides sets override_windows_json and returns schedule', async () => {
    const override: ScheduleOverride = {
      id: 'ov-1',
      name: 'Holiday Closure',
      reason: 'Christmas',
      starts_at: '2026-12-25T00:00:00Z',
      ends_at: '2026-12-26T00:00:00Z',
      mode: 'closed',
      status: 'active',
      created_by_user_id: 'user-1',
      created_at: '2026-12-01T00:00:00Z',
      revoked_by_user_id: null,
      revoked_at: null,
    };
    const updated = { ...base, override_windows_json: [override] };
    const pool = makePool([updated]);
    const result = await new ScheduleRepository(pool).replaceOverrides(SCHEDULE_ID, TENANT, [override]);
    expect(result?.override_windows_json).toHaveLength(1);
  });

  it('replaceOverrides returns null when schedule not found', async () => {
    const pool = makePool([]);
    expect(await new ScheduleRepository(pool).replaceOverrides('missing', TENANT, [])).toBeNull();
  });
});
