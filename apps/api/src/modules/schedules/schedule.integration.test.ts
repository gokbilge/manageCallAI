import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Enterprise schedules API integration (#311-#312)', () => {
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

  async function register(suffix: string): Promise<string> {
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
    return res.json<{ token: string }>().token;
  }

  async function createSchedule(token: string, suffix: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: `Business Hours ${suffix}`,
        timezone: 'UTC',
        weekly_rules_json: [{ day_of_week: 1, open_time: '09:00', close_time: '17:00' }],
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json<{ data: { id: string } }>().data.id;
  }

  it('schedule group lifecycle covers create, list, get, update, and deactivate', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const scheduleId = await createSchedule(token, 'Lifecycle');

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/schedules',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json<{ data: Array<{ id: string }> }>().data).toHaveLength(1);

    const get = await app.inject({
      method: 'GET',
      url: `/api/v1/schedules/${scheduleId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(get.statusCode).toBe(200);
    expect(get.json<{ data: { id: string; holiday_calendars: unknown[]; temporary_overrides: unknown[] } }>().data).toMatchObject({
      id: scheduleId,
      holiday_calendars: [],
      temporary_overrides: [],
    });

    const update = await app.inject({
      method: 'PATCH',
      url: `/api/v1/schedules/${scheduleId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Updated Hours',
        holiday_overrides_json: [{ date: '2026-12-24', closed: false, open_time: '10:00', close_time: '14:00' }],
      },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json<{ data: { name: string; holiday_overrides_json: Array<{ date: string }> } }>().data).toMatchObject({
      name: 'Updated Hours',
      holiday_overrides_json: [{ date: '2026-12-24' }],
    });

    const deactivate = await app.inject({
      method: 'POST',
      url: `/api/v1/schedules/${scheduleId}/deactivate`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deactivate.statusCode).toBe(200);
    expect(deactivate.json<{ data: { status: string } }>().data.status).toBe('inactive');
  });

  it('manages holiday calendars under a schedule group', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const scheduleId = await createSchedule(token, 'Holiday');

    const create = await app.inject({
      method: 'POST',
      url: `/api/v1/schedules/${scheduleId}/holiday-calendars`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'US Holidays',
        entries_json: [{ date: '2026-12-25', closed: true, label: 'Christmas' }],
      },
    });
    expect(create.statusCode).toBe(201);
    const calendar = create.json<{ data: { id: string; name: string; entries_json: Array<{ date: string }> } }>().data;
    expect(calendar).toMatchObject({
      name: 'US Holidays',
      entries_json: [{ date: '2026-12-25' }],
    });

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/schedules/${scheduleId}/holiday-calendars`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json<{ data: unknown[] }>().data).toHaveLength(1);

    const update = await app.inject({
      method: 'PATCH',
      url: `/api/v1/schedules/${scheduleId}/holiday-calendars/${calendar.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        status: 'inactive',
        entries_json: [{ date: '2026-12-31', closed: false, open_time: '09:00', close_time: '12:00', label: 'New Year Eve' }],
      },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json<{ data: { status: string; entries_json: Array<{ date: string }> } }>().data).toMatchObject({
      status: 'inactive',
      entries_json: [{ date: '2026-12-31' }],
    });
  });

  it('manages temporary overrides with update and cancel workflow', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const scheduleId = await createSchedule(token, 'Override');

    const create = await app.inject({
      method: 'POST',
      url: `/api/v1/schedules/${scheduleId}/overrides`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Storm closure',
        reason: 'weather',
        starts_at: '2026-01-05T13:00:00.000Z',
        ends_at: '2026-01-05T23:00:00.000Z',
        closed: true,
      },
    });
    expect(create.statusCode).toBe(201);
    const override = create.json<{ data: { id: string; status: string; closed: boolean } }>().data;
    expect(override).toMatchObject({ status: 'active', closed: true });

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/schedules/${scheduleId}/overrides`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json<{ data: unknown[] }>().data).toHaveLength(1);

    const update = await app.inject({
      method: 'PATCH',
      url: `/api/v1/schedules/${scheduleId}/overrides/${override.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        closed: false,
        open_time: '10:00',
        close_time: '15:00',
      },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json<{ data: { closed: boolean; open_time: string; close_time: string } }>().data).toMatchObject({
      closed: false,
      open_time: '10:00',
      close_time: '15:00',
    });

    const cancel = await app.inject({
      method: 'POST',
      url: `/api/v1/schedules/${scheduleId}/overrides/${override.id}/cancel`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(cancel.statusCode).toBe(200);
    expect(cancel.json<{ data: { status: string; cancelled_at: string | null } }>().data.status).toBe('cancelled');
  });

  it('enforces tenant isolation for schedule child resources', async () => {
    const suffix = randomUUID().slice(0, 8);
    const tokenA = await register(`a-${suffix}`);
    const tokenB = await register(`b-${suffix}`);
    const scheduleId = await createSchedule(tokenA, 'Isolated');

    const calendar = await app.inject({
      method: 'POST',
      url: `/api/v1/schedules/${scheduleId}/holiday-calendars`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        name: 'Private Calendar',
        entries_json: [{ date: '2026-12-25', closed: true }],
      },
    });
    const calendarId = calendar.json<{ data: { id: string } }>().data.id;

    const override = await app.inject({
      method: 'POST',
      url: `/api/v1/schedules/${scheduleId}/overrides`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        name: 'Private Override',
        starts_at: '2026-01-05T13:00:00.000Z',
        ends_at: '2026-01-05T23:00:00.000Z',
        closed: true,
      },
    });
    const overrideId = override.json<{ data: { id: string } }>().data.id;

    const listCalendars = await app.inject({
      method: 'GET',
      url: `/api/v1/schedules/${scheduleId}/holiday-calendars`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(listCalendars.statusCode).toBe(404);

    const updateCalendar = await app.inject({
      method: 'PATCH',
      url: `/api/v1/schedules/${scheduleId}/holiday-calendars/${calendarId}`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { name: 'Nope' },
    });
    expect(updateCalendar.statusCode).toBe(404);

    const listOverrides = await app.inject({
      method: 'GET',
      url: `/api/v1/schedules/${scheduleId}/overrides`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(listOverrides.statusCode).toBe(404);

    const cancelOverride = await app.inject({
      method: 'POST',
      url: `/api/v1/schedules/${scheduleId}/overrides/${overrideId}/cancel`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(cancelOverride.statusCode).toBe(404);
  });
});
