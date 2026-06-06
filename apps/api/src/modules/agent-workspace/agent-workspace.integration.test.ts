import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Agent Workspace API integration', () => {
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

  it('GET /agent-profiles -> 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/agent-profiles' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /agent-profiles -> creates agent profile', async () => {
    const { token, userId } = await register(randomUUID().slice(0, 8));

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/agent-profiles',
      headers: { authorization: `Bearer ${token}` },
      payload: { user_id: userId, display_name: 'Alice Support' },
    });
    expect(create.statusCode).toBe(201);
    const agent = create.json<{ data: { id: string; display_name: string; status: string } }>().data;
    expect(agent.display_name).toBe('Alice Support');
    expect(agent.status).toBe('active');

    const get = await app.inject({
      method: 'GET',
      url: `/api/v1/agent-profiles/${agent.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(get.statusCode).toBe(200);
    expect(get.json<{ data: { availability: unknown } }>().data.availability).toBeNull();
  });

  it('PATCH /:id/availability -> sets availability state', async () => {
    const { token, userId } = await register(randomUUID().slice(0, 8));

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/agent-profiles',
      headers: { authorization: `Bearer ${token}` },
      payload: { user_id: userId, display_name: 'Bob' },
    });
    const agentId = create.json<{ data: { id: string } }>().data.id;

    const avail = await app.inject({
      method: 'PATCH',
      url: `/api/v1/agent-profiles/${agentId}/availability`,
      headers: { authorization: `Bearer ${token}` },
      payload: { state: 'available' },
    });
    expect(avail.statusCode).toBe(200);
    expect(avail.json<{ data: { state: string } }>().data.state).toBe('available');
  });

  it('PATCH /:id/availability -> rejects invalid transition', async () => {
    const { token, userId } = await register(randomUUID().slice(0, 8));

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/agent-profiles',
      headers: { authorization: `Bearer ${token}` },
      payload: { user_id: userId, display_name: 'Carol' },
    });
    const agentId = create.json<{ data: { id: string } }>().data.id;

    // First move to 'away'
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/agent-profiles/${agentId}/availability`,
      headers: { authorization: `Bearer ${token}` },
      payload: { state: 'available' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/agent-profiles/${agentId}/availability`,
      headers: { authorization: `Bearer ${token}` },
      payload: { state: 'away' },
    });

    // away → busy is invalid
    const bad = await app.inject({
      method: 'PATCH',
      url: `/api/v1/agent-profiles/${agentId}/availability`,
      headers: { authorization: `Bearer ${token}` },
      payload: { state: 'busy' },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('tenant isolation: cannot access another tenant agent', async () => {
    const { token: t1, userId: u1 } = await register(randomUUID().slice(0, 8));
    const { token: t2 } = await register(randomUUID().slice(0, 8));

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/agent-profiles',
      headers: { authorization: `Bearer ${t1}` },
      payload: { user_id: u1, display_name: 'T1 Agent' },
    });
    const agentId = create.json<{ data: { id: string } }>().data.id;

    const cross = await app.inject({
      method: 'GET',
      url: `/api/v1/agent-profiles/${agentId}`,
      headers: { authorization: `Bearer ${t2}` },
    });
    expect(cross.statusCode).toBe(404);
  });
});
