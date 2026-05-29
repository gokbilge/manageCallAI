import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Queues API integration', () => {
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

  async function createExtension(token: string, extensionNumber: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/extensions',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        extension_number: extensionNumber,
        display_name: `Ext ${extensionNumber}`,
        sip_password: 'PhonePass123!',
      },
    });
    return res.json<{ data: { id: string } }>().data.id;
  }

  it('GET /queues -> 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/queues' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /queues -> creates queue and member operations work', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const extId = await createExtension(token, '7101');

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/queues',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Support Queue', strategy: 'simultaneous', ring_timeout_seconds: 25 },
    });
    expect(create.statusCode).toBe(201);
    const queueId = create.json<{ data: { id: string } }>().data.id;

    const member = await app.inject({
      method: 'POST',
      url: `/api/v1/queues/${queueId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: { extension_id: extId, position: 0 },
    });
    expect(member.statusCode).toBe(201);
    expect(member.json<{ data: { extension_id: string } }>().data.extension_id).toBe(extId);

    const get = await app.inject({
      method: 'GET',
      url: `/api/v1/queues/${queueId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(get.statusCode).toBe(200);
    expect(get.json<{ data: { members: unknown[] } }>().data.members).toHaveLength(1);
  });

  it('tenant isolation: cannot fetch another tenant queue', async () => {
    const token1 = await register(randomUUID().slice(0, 8));
    const token2 = await register(randomUUID().slice(0, 8));
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/queues',
      headers: { authorization: `Bearer ${token1}` },
      payload: { name: 'Private Queue' },
    });
    const queueId = create.json<{ data: { id: string } }>().data.id;

    const get = await app.inject({
      method: 'GET',
      url: `/api/v1/queues/${queueId}`,
      headers: { authorization: `Bearer ${token2}` },
    });
    expect(get.statusCode).toBe(404);
  });
});
