import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Queue Callbacks API integration', () => {
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

  async function createQueue(token: string, name: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/queues',
      headers: { authorization: `Bearer ${token}` },
      payload: { name },
    });
    return res.json<{ data: { id: string } }>().data.id;
  }

  it('GET /queue-callbacks -> 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/queue-callbacks' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /queues/:id/callbacks -> creates callback and list returns it', async () => {
    const { token } = await register(randomUUID().slice(0, 8));
    const queueId = await createQueue(token, 'Support');

    const create = await app.inject({
      method: 'POST',
      url: `/api/v1/queues/${queueId}/callbacks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { caller_phone: '+15551234567', caller_name: 'Alice' },
    });
    expect(create.statusCode).toBe(201);
    const cb = create.json<{ data: { id: string; status: string; caller_phone: string } }>().data;
    expect(cb.status).toBe('pending');
    expect(cb.caller_phone).toBe('+15551234567');

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/queues/${queueId}/callbacks`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.json<{ data: unknown[] }>().data).toHaveLength(1);

    const tenantList = await app.inject({
      method: 'GET',
      url: '/api/v1/queue-callbacks',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(tenantList.json<{ data: unknown[] }>().data).toHaveLength(1);
  });

  it('POST /queue-callbacks/:id/cancel -> cancels callback', async () => {
    const { token } = await register(randomUUID().slice(0, 8));
    const queueId = await createQueue(token, 'Billing');

    const create = await app.inject({
      method: 'POST',
      url: `/api/v1/queues/${queueId}/callbacks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { caller_phone: '+15559876543' },
    });
    const cbId = create.json<{ data: { id: string } }>().data.id;

    const cancel = await app.inject({
      method: 'POST',
      url: `/api/v1/queue-callbacks/${cbId}/cancel`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(cancel.statusCode).toBe(200);
    expect(cancel.json<{ data: { status: string } }>().data.status).toBe('cancelled');
  });

  it('PATCH /queue-callbacks/:id -> rejects invalid transition from terminal status', async () => {
    const { token } = await register(randomUUID().slice(0, 8));
    const queueId = await createQueue(token, 'Tech');

    const create = await app.inject({
      method: 'POST',
      url: `/api/v1/queues/${queueId}/callbacks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { caller_phone: '+15550000000' },
    });
    const cbId = create.json<{ data: { id: string } }>().data.id;

    // Cancel first
    await app.inject({
      method: 'POST',
      url: `/api/v1/queue-callbacks/${cbId}/cancel`,
      headers: { authorization: `Bearer ${token}` },
    });

    // Try to re-schedule — invalid from cancelled
    const bad = await app.inject({
      method: 'PATCH',
      url: `/api/v1/queue-callbacks/${cbId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'scheduled' },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('tenant isolation: cannot see another tenant callbacks', async () => {
    const { token: t1 } = await register(randomUUID().slice(0, 8));
    const { token: t2 } = await register(randomUUID().slice(0, 8));
    const queueId = await createQueue(t1, 'T1 Queue');

    await app.inject({
      method: 'POST',
      url: `/api/v1/queues/${queueId}/callbacks`,
      headers: { authorization: `Bearer ${t1}` },
      payload: { caller_phone: '+15551111111' },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/queue-callbacks',
      headers: { authorization: `Bearer ${t2}` },
    });
    expect(list.json<{ data: unknown[] }>().data).toHaveLength(0);
  });
});
