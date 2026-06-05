import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Reporting API integration', () => {
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

  async function register(): Promise<string> {
    const s = Math.random().toString(36).slice(2, 10);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: `Tenant ${s}`,
        tenant_slug: `tenant-${s}`,
        email: `user-${s}@example.com`,
        display_name: 'Test User',
        password: 'Secret123!',
      },
    });
    return res.json<{ token: string }>().token;
  }

  it('POST /reporting/nl-query → 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reporting/nl-query',
      payload: { question: 'show failed calls' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /reporting/nl-query → 400 for empty question', async () => {
    const token = await register();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reporting/nl-query',
      headers: { authorization: `Bearer ${token}` },
      payload: { question: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /reporting/nl-query → 400 for unsupported question', async () => {
    const token = await register();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reporting/nl-query',
      headers: { authorization: `Bearer ${token}` },
      payload: { question: 'what is the weather today' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /reporting/nl-query → 200 with advisory result for call query', async () => {
    const token = await register();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reporting/nl-query',
      headers: { authorization: `Bearer ${token}` },
      payload: { question: 'show failed calls today' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { is_advisory: boolean; question: string; applied_filters: unknown[]; result_count: number } }>();
    expect(body.data.is_advisory).toBe(true);
    expect(body.data.question).toBe('show failed calls today');
    expect(body.data.applied_filters).toBeInstanceOf(Array);
    expect(typeof body.data.result_count).toBe('number');
  });

  it('POST /reporting/nl-query → 200 for count query with zero results on empty DB', async () => {
    const token = await register();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reporting/nl-query',
      headers: { authorization: `Bearer ${token}` },
      payload: { question: 'how many outbound calls last week' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { result_count: number; results: unknown[] } }>();
    expect(body.data.result_count).toBe(0);
    expect(body.data.results).toHaveLength(0);
  });
});
