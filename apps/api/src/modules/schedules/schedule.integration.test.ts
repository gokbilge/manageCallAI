import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Schedules API integration', () => {
  let app: FastifyInstance;
  let db: Pool;

  beforeAll(async () => {
    process.env.RUNTIME_API_TOKEN ??= 'test-runtime-token';
    process.env.JWT_SECRET ??= 'test-jwt-secret';
    process.env.SIP_SECRET_MASTER_KEY ??=
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.SIP_SECRET_KEY_ID ??= 'test-v1';

    const { buildApp } = await import('../../app.js');
    ({ db } = await import('../../db/client.js'));
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await db.end();
  });

  beforeEach(async () => {
    await db.query('TRUNCATE TABLE tenants CASCADE');
  });

  async function register(suffix: string): Promise<{ token: string; userId: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: `Tenant ${suffix}`,
        tenant_slug: `tenant-${suffix}`,
        email: `user-${suffix}@example.com`,
        display_name: 'Test User',
        password: 'Secret123!',
      },
    });
    const { token } = res.json<{ token: string }>();
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { sub: string };
    return { token, userId: payload.sub };
  }

  it('creates linked schedule assets and keeps schedule snapshots in sync', async () => {
    const { token } = await register(randomUUID().slice(0, 8));

    const createGroup = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules/groups',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Weekday Core',
        weekly_rules_json: [
          { day_of_week: 1, open_time: '09:00', close_time: '17:00' },
          { day_of_week: 2, open_time: '09:00', close_time: '17:00' },
        ],
      },
    });
    expect(createGroup.statusCode).toBe(201);
    const groupId = createGroup.json<{ data: { id: string } }>().data.id;

    const createCalendar = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules/holiday-calendars',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Closures',
        entries_json: [
          { date: '2026-12-25', closed: true, name: 'Christmas Day' },
        ],
      },
    });
    expect(createCalendar.statusCode).toBe(201);
    const calendarId = createCalendar.json<{ data: { id: string } }>().data.id;

    const createSchedule = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Main Support',
        timezone: 'America/New_York',
        schedule_group_id: groupId,
        holiday_calendar_id: calendarId,
      },
    });
    expect(createSchedule.statusCode).toBe(201);
    const schedule = createSchedule.json<{ data: { id: string; weekly_rules_json: unknown[]; holiday_overrides_json: unknown[] } }>().data;
    expect(schedule.weekly_rules_json).toHaveLength(2);
    expect(schedule.holiday_overrides_json).toHaveLength(1);

    const patchGroup = await app.inject({
      method: 'PATCH',
      url: `/api/v1/schedules/groups/${groupId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        weekly_rules_json: [
          { day_of_week: 1, open_time: '08:00', close_time: '18:00' },
        ],
      },
    });
    expect(patchGroup.statusCode).toBe(200);

    const getSchedule = await app.inject({
      method: 'GET',
      url: `/api/v1/schedules/${schedule.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getSchedule.statusCode).toBe(200);
    expect(getSchedule.json<{ data: { weekly_rules_json: Array<{ open_time: string }> } }>().data.weekly_rules_json[0]?.open_time).toBe('08:00');
  });

  it('creates and cancels temporary overrides', async () => {
    const { token } = await register(randomUUID().slice(0, 8));

    const createSchedule = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Main Support',
        timezone: 'UTC',
      },
    });
    const scheduleId = createSchedule.json<{ data: { id: string } }>().data.id;

    const createOverride = await app.inject({
      method: 'POST',
      url: `/api/v1/schedules/${scheduleId}/overrides`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Storm closure',
        mode: 'closed',
        starts_at: '2026-06-10T10:00:00.000Z',
        ends_at: '2026-06-10T12:00:00.000Z',
      },
    });
    expect(createOverride.statusCode).toBe(201);
    const overrideId = createOverride.json<{ data: { id: string; lifecycle_state: string } }>().data.id;

    const listOverrides = await app.inject({
      method: 'GET',
      url: `/api/v1/schedules/${scheduleId}/overrides`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listOverrides.statusCode).toBe(200);
    expect(listOverrides.json<{ data: unknown[] }>().data).toHaveLength(1);

    const cancelOverride = await app.inject({
      method: 'POST',
      url: `/api/v1/schedules/${scheduleId}/overrides/${overrideId}/cancel`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(cancelOverride.statusCode).toBe(200);
    expect(cancelOverride.json<{ data: { lifecycle_state: string } }>().data.lifecycle_state).toBe('cancelled');
  });

  it('rejects overlapping overrides for the same schedule', async () => {
    const { token } = await register(randomUUID().slice(0, 8));

    const createSchedule = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Main Support',
        timezone: 'UTC',
      },
    });
    const scheduleId = createSchedule.json<{ data: { id: string } }>().data.id;

    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/schedules/${scheduleId}/overrides`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Weather closure',
        mode: 'closed',
        starts_at: '2026-06-10T10:00:00.000Z',
        ends_at: '2026-06-10T12:00:00.000Z',
      },
    });
    expect(first.statusCode).toBe(201);

    const overlapping = await app.inject({
      method: 'POST',
      url: `/api/v1/schedules/${scheduleId}/overrides`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Second closure',
        mode: 'closed',
        starts_at: '2026-06-10T11:00:00.000Z',
        ends_at: '2026-06-10T13:00:00.000Z',
      },
    });
    expect(overlapping.statusCode).toBe(400);
  });
});
