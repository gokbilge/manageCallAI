import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

async function truncateTenantsWithRetry(db: Pool): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await db.query('TRUNCATE TABLE tenants CASCADE');
      return;
    } catch (error) {
      const maybePgError = error as { code?: string };
      if (maybePgError.code !== '40P01' || attempt === 2) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
}

describe('Conference Rooms API integration', () => {
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
    await truncateTenantsWithRetry(db);
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

  function decodeJwt(token: string): { tenant_id: string } {
    const [, payload] = token.split('.');
    return JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8')) as { tenant_id: string };
  }

  function scopedToken(baseToken: string, role: 'tenant_operator' | 'tenant_viewer'): string {
    const { tenant_id } = decodeJwt(baseToken);
    return app.jwt.sign({
      sub: randomUUID(),
      tenant_id,
      email: `${role}-${randomUUID().slice(0, 8)}@example.com`,
      role,
    });
  }

  it('GET /conference-rooms -> 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/conference-rooms' });
    expect(res.statusCode).toBe(401);
  });

  it('conference room CRUD lifecycle', async () => {
    const token = await register(randomUUID().slice(0, 8));

    // Create without PIN
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/conference-rooms',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Board Room', room_number: '8100', max_participants: 10 },
    });
    expect(create.statusCode).toBe(201);
    const room = create.json<{ data: { id: string; has_pin: boolean; status: string } }>().data;
    expect(room.has_pin).toBe(false);
    expect(room.status).toBe('active');

    // PIN is never returned
    const rawData = create.json<Record<string, unknown>>().data as Record<string, unknown>;
    expect(rawData.pin).toBeUndefined();
    expect(rawData.pin_ciphertext).toBeUndefined();

    // List
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/conference-rooms',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json<{ data: unknown[] }>().data).toHaveLength(1);

    // Get
    const get = await app.inject({
      method: 'GET',
      url: `/api/v1/conference-rooms/${room.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(get.statusCode).toBe(200);

    // Patch (set PIN)
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/conference-rooms/${room.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { pin: '1234' },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json<{ data: { has_pin: boolean } }>().data.has_pin).toBe(true);

    // Disable
    const disable = await app.inject({
      method: 'POST',
      url: `/api/v1/conference-rooms/${room.id}/disable`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(disable.statusCode).toBe(200);
    expect(disable.json<{ data: { status: string } }>().data.status).toBe('disabled');

    // Enable
    const enable = await app.inject({
      method: 'POST',
      url: `/api/v1/conference-rooms/${room.id}/enable`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(enable.statusCode).toBe(200);
    expect(enable.json<{ data: { status: string } }>().data.status).toBe('active');

    // Participants (empty)
    const participants = await app.inject({
      method: 'GET',
      url: `/api/v1/conference-rooms/${room.id}/participants`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(participants.statusCode).toBe(200);
    expect(participants.json<{ data: unknown[] }>().data).toHaveLength(0);

    // Delete
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/conference-rooms/${room.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(204);
  });

  it('tenant isolation: Tenant A cannot see Tenant B rooms', async () => {
    const s = randomUUID().slice(0, 8);
    const tokenA = await register(`a-${s}`);
    const tokenB = await register(`b-${s}`);

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/conference-rooms',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { name: 'Room A', room_number: '8200' },
    });
    const roomId = create.json<{ data: { id: string } }>().data.id;

    const getB = await app.inject({
      method: 'GET',
      url: `/api/v1/conference-rooms/${roomId}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(getB.statusCode).toBe(404);
  });

  it('PATCH /conference-rooms/:id -> 404 for nonexistent', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/conference-rooms/${randomUUID()}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /conference-rooms/:id -> 404 for nonexistent', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/conference-rooms/${randomUUID()}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('runtime conference join/leave via callbacks', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/conference-rooms',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Live Room', room_number: '8300' },
    });
    const { id: roomId } = create.json<{ data: { id: string } }>().data;
    const tenantRow = await db.query<{ tenant_id: string }>('SELECT tenant_id FROM conference_rooms WHERE id = $1', [roomId]);
    const tenantId = tenantRow.rows[0]!.tenant_id;

    const callId = randomUUID();

    const join = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/conference/joined',
      headers: { authorization: `Bearer ${process.env.RUNTIME_API_TOKEN}` },
      payload: { tenant_id: tenantId, conference_room_id: roomId, call_id: callId },
    });
    expect(join.statusCode).toBe(200);

    // Verify participants
    const participants = await app.inject({
      method: 'GET',
      url: `/api/v1/conference-rooms/${roomId}/participants`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(participants.json<{ data: unknown[] }>().data).toHaveLength(1);

    const leave = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/conference/left',
      headers: { authorization: `Bearer ${process.env.RUNTIME_API_TOKEN}` },
      payload: { tenant_id: tenantId, conference_room_id: roomId, call_id: callId },
    });
    expect(leave.statusCode).toBe(200);
  });

  it('tenant_viewer can list but cannot create conference rooms', async () => {
    const adminToken = await register(randomUUID().slice(0, 8));
    const viewerToken = scopedToken(adminToken, 'tenant_viewer');

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/conference-rooms',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(list.statusCode).toBe(200);

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/conference-rooms',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { name: 'Viewer Room', room_number: '8400' },
    });
    expect(create.statusCode).toBe(403);
  });

  it('tenant_operator can create and update but cannot disable conference rooms', async () => {
    const adminToken = await register(randomUUID().slice(0, 8));
    const operatorToken = scopedToken(adminToken, 'tenant_operator');

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/conference-rooms',
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: { name: 'Ops Room', room_number: '8500', max_participants: 8 },
    });
    expect(create.statusCode).toBe(201);
    const roomId = create.json<{ data: { id: string } }>().data.id;

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/conference-rooms/${roomId}`,
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: { name: 'Ops Room Updated' },
    });
    expect(patch.statusCode).toBe(200);

    const disable = await app.inject({
      method: 'POST',
      url: `/api/v1/conference-rooms/${roomId}/disable`,
      headers: { authorization: `Bearer ${operatorToken}` },
    });
    expect(disable.statusCode).toBe(403);
  });
});
