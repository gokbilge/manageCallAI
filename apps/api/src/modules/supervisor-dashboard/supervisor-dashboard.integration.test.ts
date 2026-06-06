import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Supervisor Dashboard API integration', () => {
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

  it('GET /supervisor/dashboard -> 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/supervisor/dashboard' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /supervisor/wallboard -> 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/supervisor/wallboard' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /supervisor/dashboard -> returns empty dashboard for new tenant', async () => {
    const { token } = await register(randomUUID().slice(0, 8));

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/supervisor/dashboard',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { queues: unknown[]; agents: unknown[]; sla_metrics: unknown[]; captured_at: string } }>().data;
    expect(body.queues).toHaveLength(0);
    expect(body.agents).toHaveLength(0);
    expect(body.sla_metrics).toHaveLength(0);
    expect(body.captured_at).toBeDefined();
  });

  it('GET /supervisor/wallboard -> returns agent count breakdown', async () => {
    const { token } = await register(randomUUID().slice(0, 8));

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/supervisor/wallboard',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      data: {
        queues: unknown[];
        agents_available: number;
        agents_busy: number;
        agents_away: number;
        agents_offline: number;
        captured_at: string;
      };
    }>().data;
    expect(body.agents_available).toBe(0);
    expect(body.agents_busy).toBe(0);
    expect(body.captured_at).toBeDefined();
  });

  it('GET /supervisor/dashboard -> reflects queues after creation', async () => {
    const { token } = await register(randomUUID().slice(0, 8));

    await app.inject({
      method: 'POST',
      url: '/api/v1/queues',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Support Queue' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/supervisor/dashboard',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const { queues } = res.json<{ data: { queues: { queue_name: string }[] } }>().data;
    expect(queues).toHaveLength(1);
    expect(queues[0]!.queue_name).toBe('Support Queue');
  });
});
