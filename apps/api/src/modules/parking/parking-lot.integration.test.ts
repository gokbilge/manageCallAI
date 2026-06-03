import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Parking Lots API integration', () => {
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

  it('GET /parking-lots -> 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/parking-lots' });
    expect(res.statusCode).toBe(401);
  });

  it('parking lot CRUD lifecycle', async () => {
    const token = await register(randomUUID().slice(0, 8));

    // Create
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/parking-lots',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Main Lot', slot_range_start: 801, slot_range_end: 810, timeout_seconds: 300 },
    });
    expect(create.statusCode).toBe(201);
    const lot = create.json<{ data: { id: string; name: string } }>().data;
    expect(lot.name).toBe('Main Lot');

    // List
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/parking-lots',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json<{ data: unknown[] }>().data).toHaveLength(1);

    // Get
    const get = await app.inject({
      method: 'GET',
      url: `/api/v1/parking-lots/${lot.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(get.statusCode).toBe(200);

    // Patch
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/parking-lots/${lot.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { timeout_seconds: 600 },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json<{ data: { timeout_seconds: number } }>().data.timeout_seconds).toBe(600);

    // List parked calls (empty)
    const calls = await app.inject({
      method: 'GET',
      url: `/api/v1/parking-lots/${lot.id}/parked-calls`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(calls.statusCode).toBe(200);
    expect(calls.json<{ data: unknown[] }>().data).toHaveLength(0);

    // Delete
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/parking-lots/${lot.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(204);
  });

  it('tenant isolation: Tenant A cannot see Tenant B lots', async () => {
    const s = randomUUID().slice(0, 8);
    const tokenA = await register(`a-${s}`);
    const tokenB = await register(`b-${s}`);

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/parking-lots',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { name: 'Lot A' },
    });
    const lotId = create.json<{ data: { id: string } }>().data.id;

    const getB = await app.inject({
      method: 'GET',
      url: `/api/v1/parking-lots/${lotId}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(getB.statusCode).toBe(404);
  });

  it('GET /parking-lots/:id returns 404 for nonexistent lot', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/parking-lots/${randomUUID()}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('runtime park/retrieve via API callbacks', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/parking-lots',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Test Lot', slot_range_start: 801, slot_range_end: 810 },
    });
    const { id: lotId } = create.json<{ data: { id: string } }>().data;

    // Find tenant_id from DB (needed for runtime calls)
    const lotRow = await db.query<{ tenant_id: string }>('SELECT tenant_id FROM parking_lots WHERE id = $1', [lotId]);
    const tenantId = lotRow.rows[0]!.tenant_id;

    // Park via runtime endpoint
    const park = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/parking/park',
      headers: { authorization: `Bearer ${process.env.RUNTIME_API_TOKEN}` },
      payload: { tenant_id: tenantId, slot: 801, call_id: 'call-uuid-1', parked_by: '101' },
    });
    expect(park.statusCode).toBe(201);
    expect(park.json<{ data: { status: string } }>().data.status).toBe('parked');

    // Check parked calls list
    const calls = await app.inject({
      method: 'GET',
      url: `/api/v1/parking-lots/${lotId}/parked-calls`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(calls.json<{ data: unknown[] }>().data).toHaveLength(1);

    // Retrieve via runtime endpoint
    const retrieve = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/parking/retrieve',
      headers: { authorization: `Bearer ${process.env.RUNTIME_API_TOKEN}` },
      payload: { tenant_id: tenantId, slot: 801 },
    });
    expect(retrieve.statusCode).toBe(200);
    expect(retrieve.json<{ data: { status: string } }>().data.status).toBe('retrieved');
  });
});
