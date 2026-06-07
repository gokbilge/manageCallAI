import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Schedules enterprise model (#311, #312)', () => {
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

  afterAll(async () => { await app.close(); await db.end(); });
  beforeEach(async () => { await db.query('TRUNCATE TABLE tenants CASCADE'); });

  async function register(seed: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: `Tenant ${seed}`,
        tenant_slug: `tenant-${seed}`,
        email: `admin-${seed}@example.com`,
        display_name: 'Admin',
        password: 'Secret123!',
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json<{ token: string }>().token;
  }

  it('creates and reads a schedule with holiday calendar metadata', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Headquarters',
        description: 'Primary business-hours group',
        timezone: 'America/New_York',
        weekly_rules_json: [{ day_of_week: 1, open_time: '09:00', close_time: '17:00' }],
        holiday_calendar_name: 'US Holidays',
        holiday_calendar_json: [{ date: '2026-01-01', name: 'New Year', closed: true }],
      },
    });
    expect(createRes.statusCode, createRes.body).toBe(201);

    const created = createRes.json<{ data: { id: string; holiday_calendar_name: string | null; holiday_calendar_json: unknown[] } }>().data;
    expect(created.holiday_calendar_name).toBe('US Holidays');
    expect(created.holiday_calendar_json).toHaveLength(1);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/schedules/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json<{ data: { description: string | null } }>().data.description).toBe('Primary business-hours group');
  });

  it('adds and revokes a temporary override', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Emergency Line', timezone: 'UTC' },
    });
    const scheduleId = createRes.json<{ data: { id: string } }>().data.id;

    const addRes = await app.inject({
      method: 'POST',
      url: `/api/v1/schedules/${scheduleId}/overrides`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Storm closure',
        reason: 'Snow emergency',
        starts_at: '2026-01-05T13:00:00.000Z',
        ends_at: '2026-01-05T18:00:00.000Z',
        mode: 'closed',
      },
    });
    expect(addRes.statusCode, addRes.body).toBe(201);
    const added = addRes.json<{ data: { override_windows_json: Array<{ id: string; status: string }> } }>().data;
    expect(added.override_windows_json).toHaveLength(1);
    expect(added.override_windows_json[0]!.status).toBe('active');

    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/schedules/${scheduleId}/overrides/${added.override_windows_json[0]!.id}/revoke`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(revokeRes.statusCode, revokeRes.body).toBe(200);
    expect(revokeRes.json<{ data: { override_windows_json: Array<{ status: string }> } }>().data.override_windows_json[0]!.status).toBe('revoked');
  });

  it('enforces tenant isolation on override workflows', async () => {
    const tokenA = await register(randomUUID().slice(0, 8));
    const tokenB = await register(randomUUID().slice(0, 8));

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { name: 'Tenant B Schedule', timezone: 'UTC' },
    });
    const scheduleId = createRes.json<{ data: { id: string } }>().data.id;

    const addRes = await app.inject({
      method: 'POST',
      url: `/api/v1/schedules/${scheduleId}/overrides`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        name: 'Hijack',
        starts_at: '2026-01-05T13:00:00.000Z',
        ends_at: '2026-01-05T18:00:00.000Z',
        mode: 'closed',
      },
    });
    expect([403, 404]).toContain(addRes.statusCode);
  });
});
