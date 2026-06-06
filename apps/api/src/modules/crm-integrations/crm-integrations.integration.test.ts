import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('CRM Integrations API integration', () => {
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

  it('GET /crm-integrations -> 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/crm-integrations' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /crm-integrations -> creates integration', async () => {
    const token = await register(randomUUID().slice(0, 8));

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/crm-integrations',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Test CRM',
        provider: 'generic_webhook',
        lookup_url_template: 'https://api.example.com/lookup?phone={caller_id}',
      },
    });
    expect(create.statusCode).toBe(201);
    const crm = create.json<{ data: { id: string; name: string; status: string } }>().data;
    expect(crm.name).toBe('Test CRM');
    expect(crm.status).toBe('active');

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/crm-integrations',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.json<{ data: unknown[] }>().data).toHaveLength(1);
  });

  it('POST /crm-integrations -> rejects template without {caller_id}', async () => {
    const token = await register(randomUUID().slice(0, 8));

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/crm-integrations',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Bad',
        provider: 'hubspot',
        lookup_url_template: 'https://api.example.com/no-placeholder',
      },
    });
    expect(create.statusCode).toBe(400);
  });

  it('tenant isolation: cannot see another tenant CRM integrations', async () => {
    const t1 = await register(randomUUID().slice(0, 8));
    const t2 = await register(randomUUID().slice(0, 8));

    await app.inject({
      method: 'POST',
      url: '/api/v1/crm-integrations',
      headers: { authorization: `Bearer ${t1}` },
      payload: { name: 'T1 CRM', provider: 'salesforce', lookup_url_template: 'https://x.com?p={caller_id}' },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/crm-integrations',
      headers: { authorization: `Bearer ${t2}` },
    });
    expect(list.json<{ data: unknown[] }>().data).toHaveLength(0);
  });
});
