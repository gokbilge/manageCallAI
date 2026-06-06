import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Supervisor Controls API integration', () => {
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

  it('GET /supervisor/controls -> 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/supervisor/controls' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /supervisor/controls -> creates a monitor session', async () => {
    const { token } = await register(randomUUID().slice(0, 8));

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/supervisor/controls',
      headers: { authorization: `Bearer ${token}` },
      payload: { control_type: 'monitor', target_call_id: 'call-uuid-123' },
    });
    expect(create.statusCode).toBe(201);
    const ctrl = create.json<{ data: { id: string; control_type: string; status: string } }>().data;
    expect(ctrl.control_type).toBe('monitor');
    expect(ctrl.status).toBe('pending');

    // Transition pending → active
    const activate = await app.inject({
      method: 'PATCH',
      url: `/api/v1/supervisor/controls/${ctrl.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'active' },
    });
    expect(activate.statusCode).toBe(200);
    expect(activate.json<{ data: { status: string } }>().data.status).toBe('active');

    // End the session
    const end = await app.inject({
      method: 'POST',
      url: `/api/v1/supervisor/controls/${ctrl.id}/end`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(end.statusCode).toBe(200);
    expect(end.json<{ data: { status: string } }>().data.status).toBe('ended');
  });

  it('PATCH /supervisor/controls/:id -> rejects invalid transition', async () => {
    const { token } = await register(randomUUID().slice(0, 8));

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/supervisor/controls',
      headers: { authorization: `Bearer ${token}` },
      payload: { control_type: 'whisper', target_call_id: 'call-xyz' },
    });
    const ctrlId = create.json<{ data: { id: string } }>().data.id;

    // End it first
    await app.inject({
      method: 'POST',
      url: `/api/v1/supervisor/controls/${ctrlId}/end`,
      headers: { authorization: `Bearer ${token}` },
    });

    // ended → active is invalid
    const bad = await app.inject({
      method: 'PATCH',
      url: `/api/v1/supervisor/controls/${ctrlId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'active' },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('tenant isolation: cannot access another tenant control', async () => {
    const { token: t1 } = await register(randomUUID().slice(0, 8));
    const { token: t2 } = await register(randomUUID().slice(0, 8));

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/supervisor/controls',
      headers: { authorization: `Bearer ${t1}` },
      payload: { control_type: 'barge', target_call_id: 'call-abc' },
    });
    const ctrlId = create.json<{ data: { id: string } }>().data.id;

    const cross = await app.inject({
      method: 'GET',
      url: `/api/v1/supervisor/controls/${ctrlId}`,
      headers: { authorization: `Bearer ${t2}` },
    });
    expect(cross.statusCode).toBe(404);
  });
});
