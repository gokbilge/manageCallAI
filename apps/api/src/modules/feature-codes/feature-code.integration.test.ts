import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Feature Codes API integration', () => {
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

  it('GET /feature-codes -> 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/feature-codes' });
    expect(res.statusCode).toBe(401);
  });

  it('feature code CRUD lifecycle', async () => {
    const token = await register(randomUUID().slice(0, 8));

    // Create
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/feature-codes',
      headers: { authorization: `Bearer ${token}` },
      payload: { code: '*72', name: 'Enable Call Forward', action_type: 'call_forward_enable' },
    });
    expect(create.statusCode).toBe(201);
    const fc = create.json<{ data: { id: string; status: string; code: string } }>().data;
    expect(fc.status).toBe('draft');
    expect(fc.code).toBe('*72');

    // Get
    const get = await app.inject({
      method: 'GET',
      url: `/api/v1/feature-codes/${fc.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(get.statusCode).toBe(200);

    // Update
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/feature-codes/${fc.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Updated Forward' },
    });
    expect(patch.statusCode).toBe(200);

    // Validate
    const validate = await app.inject({
      method: 'POST',
      url: `/api/v1/feature-codes/${fc.id}/validate`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(validate.statusCode).toBe(200);
    const vResult = validate.json<{ data: { valid: boolean } }>().data;
    expect(vResult.valid).toBe(true);

    // Publish
    const publish = await app.inject({
      method: 'POST',
      url: `/api/v1/feature-codes/${fc.id}/publish`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(publish.statusCode).toBe(200);
    expect(publish.json<{ data: { status: string } }>().data.status).toBe('active');

    // Disable
    const disable = await app.inject({
      method: 'POST',
      url: `/api/v1/feature-codes/${fc.id}/disable`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(disable.statusCode).toBe(200);
    expect(disable.json<{ data: { status: string } }>().data.status).toBe('disabled');

    // Delete
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/feature-codes/${fc.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(204);
  });

  it('rejects emergency number codes', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/feature-codes',
      headers: { authorization: `Bearer ${token}` },
      payload: { code: '911', name: 'Bad', action_type: 'voicemail_access' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('tenant isolation: Tenant A cannot see Tenant B codes', async () => {
    const s = randomUUID().slice(0, 8);
    const tokenA = await register(`a-${s}`);
    const tokenB = await register(`b-${s}`);

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/feature-codes',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { code: '*99', name: 'A code', action_type: 'dnd_enable' },
    });
    expect(create.statusCode).toBe(201);
    const id = create.json<{ data: { id: string } }>().data.id;

    const getB = await app.inject({
      method: 'GET',
      url: `/api/v1/feature-codes/${id}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(getB.statusCode).toBe(404);
  });

  it('GET /feature-codes/:id -> 404 for nonexistent', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/feature-codes/${randomUUID()}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /feature-codes/:id -> 404 for nonexistent', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/feature-codes/${randomUUID()}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /feature-codes/:id/validate -> 404 for nonexistent', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/feature-codes/${randomUUID()}/validate`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('list returns codes for tenant', async () => {
    const token = await register(randomUUID().slice(0, 8));
    await app.inject({
      method: 'POST',
      url: '/api/v1/feature-codes',
      headers: { authorization: `Bearer ${token}` },
      payload: { code: '*73', name: 'Park', action_type: 'call_park' },
    });
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/feature-codes',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json<{ data: unknown[] }>().data.length).toBeGreaterThan(0);
  });

  it('tenant_viewer can list but cannot create feature codes', async () => {
    const adminToken = await register(randomUUID().slice(0, 8));
    const viewerToken = scopedToken(adminToken, 'tenant_viewer');

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/feature-codes',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(list.statusCode).toBe(200);

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/feature-codes',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { code: '*71', name: 'Retrieve', action_type: 'call_park_retrieve' },
    });
    expect(create.statusCode).toBe(403);
  });

  it('tenant_operator can create and validate but cannot publish feature codes', async () => {
    const adminToken = await register(randomUUID().slice(0, 8));
    const operatorToken = scopedToken(adminToken, 'tenant_operator');

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/feature-codes',
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: { code: '*74', name: 'Join Conference', action_type: 'conference_join' },
    });
    expect(create.statusCode).toBe(201);
    const featureCodeId = create.json<{ data: { id: string } }>().data.id;

    const validate = await app.inject({
      method: 'POST',
      url: `/api/v1/feature-codes/${featureCodeId}/validate`,
      headers: { authorization: `Bearer ${operatorToken}` },
    });
    expect(validate.statusCode).toBe(200);

    const publish = await app.inject({
      method: 'POST',
      url: `/api/v1/feature-codes/${featureCodeId}/publish`,
      headers: { authorization: `Bearer ${operatorToken}` },
    });
    expect(publish.statusCode).toBe(403);
  });
});
