import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Risk Analysis API integration', () => {
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
    const suffix = randomUUID().slice(0, 8);
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

  it('POST /risk-analysis/route → 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/risk-analysis/route',
      payload: { target_type: 'outbound_route', target_id: randomUUID() },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /risk-analysis/route → 400 for unsupported target type', async () => {
    const token = await register();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/risk-analysis/route',
      headers: { authorization: `Bearer ${token}` },
      payload: { target_type: 'unknown_type', target_id: randomUUID() },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /risk-analysis/route → 404 for unknown outbound route', async () => {
    const token = await register();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/risk-analysis/route',
      headers: { authorization: `Bearer ${token}` },
      payload: { target_type: 'outbound_route', target_id: randomUUID() },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /risk-analysis/route → 404 for unknown inbound route', async () => {
    const token = await register();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/risk-analysis/route',
      headers: { authorization: `Bearer ${token}` },
      payload: { target_type: 'inbound_route', target_id: randomUUID() },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /risk-analysis/route → 404 for unknown sip trunk', async () => {
    const token = await register();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/risk-analysis/route',
      headers: { authorization: `Bearer ${token}` },
      payload: { target_type: 'sip_trunk', target_id: randomUUID() },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /risk-analysis/route → 200 with advisory analysis for outbound route', async () => {
    const token = await register();

    const trunkRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sip-trunks',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Test Trunk',
        direction: 'outbound',
        realm: 'sip.example.com',
        proxy: 'sip.example.com',
        auth_username: 'user',
        auth_password: 'Secret123!',
      },
    });
    const trunkId: string = trunkRes.json<{ data: { id: string } }>().data.id;

    const routeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/outbound-routes',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'US Domestic', match_prefix: '+1', sip_trunk_id: trunkId },
    });
    const routeId: string = routeRes.json<{ data: { id: string } }>().data.id;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/risk-analysis/route',
      headers: { authorization: `Bearer ${token}` },
      payload: { target_type: 'outbound_route', target_id: routeId },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { risk_level: string; is_advisory: boolean; target_name: string } }>();
    expect(body.data.is_advisory).toBe(true);
    expect(body.data.target_name).toBe('US Domestic');
    expect(['low', 'medium', 'high']).toContain(body.data.risk_level);
  });

  it('POST /risk-analysis/route → 200 with analysis for SIP trunk', async () => {
    const token = await register();

    const trunkRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sip-trunks',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'My Trunk',
        direction: 'outbound',
        realm: 'sip.example.com',
        proxy: 'sip.example.com',
        auth_username: 'user',
        auth_password: 'Secret123!',
      },
    });
    const trunkId: string = trunkRes.json<{ data: { id: string } }>().data.id;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/risk-analysis/route',
      headers: { authorization: `Bearer ${token}` },
      payload: { target_type: 'sip_trunk', target_id: trunkId },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { is_advisory: boolean; target_name: string } }>();
    expect(body.data.is_advisory).toBe(true);
    expect(body.data.target_name).toBe('My Trunk');
  });
});
