import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('SIP Trunks API integration', () => {
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

  const validBody = () => ({
    name: 'Main Trunk',
    direction: 'inbound',
    realm: 'sip.provider.example',
    proxy: 'sip.provider.example',
    auth_username: 'trunk-user',
    auth_password: 'SuperSecret99!',
  });

  it('GET /sip-trunks → 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/sip-trunks' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /sip-trunks → creates trunk', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sip-trunks',
      headers: { authorization: `Bearer ${token}` },
      payload: validBody(),
    });
    expect(res.statusCode).toBe(201);
    const { data } = res.json<{ data: Record<string, unknown> }>();
    expect(data['name']).toBe('Main Trunk');
    expect(data['direction']).toBe('inbound');
    expect(data['status']).toBe('active');
    expect(data['realm']).toBe('sip.provider.example');
    expect(data).not.toHaveProperty('auth_secret_ciphertext');
    expect(data).not.toHaveProperty('auth_password_ciphertext');
    expect(data).not.toHaveProperty('auth_password_key_id');
    expect(data).not.toHaveProperty('auth_password');
  });

  it('GET /sip-trunks → lists tenant trunks', async () => {
    const token = await register(randomUUID().slice(0, 8));
    await app.inject({ method: 'POST', url: '/api/v1/sip-trunks', headers: { authorization: `Bearer ${token}` }, payload: { ...validBody(), name: 'Trunk A' } });
    await app.inject({ method: 'POST', url: '/api/v1/sip-trunks', headers: { authorization: `Bearer ${token}` }, payload: { ...validBody(), name: 'Trunk B' } });
    const res = await app.inject({ method: 'GET', url: '/api/v1/sip-trunks', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    const { data } = res.json<{ data: unknown[] }>();
    expect(data).toHaveLength(2);
  });

  it('GET /sip-trunks/:id → 404 for unknown id', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({ method: 'GET', url: `/api/v1/sip-trunks/${randomUUID()}`, headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /sip-trunks/:id → updates trunk', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const create = await app.inject({ method: 'POST', url: '/api/v1/sip-trunks', headers: { authorization: `Bearer ${token}` }, payload: validBody() });
    const id = create.json<{ data: { id: string } }>().data.id;
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sip-trunks/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Updated Trunk', port: 5080 },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json<{ data: Record<string, unknown> }>();
    expect(data['name']).toBe('Updated Trunk');
    expect(data['port']).toBe(5080);
  });

  it('POST /sip-trunks/:id/deactivate → deactivates trunk', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const create = await app.inject({ method: 'POST', url: '/api/v1/sip-trunks', headers: { authorization: `Bearer ${token}` }, payload: validBody() });
    const id = create.json<{ data: { id: string } }>().data.id;
    const res = await app.inject({ method: 'POST', url: `/api/v1/sip-trunks/${id}/deactivate`, headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: { status: string } }>().data.status).toBe('inactive');
  });

  it('tenant isolation: cannot see another tenant trunk', async () => {
    const token1 = await register(randomUUID().slice(0, 8));
    const token2 = await register(randomUUID().slice(0, 8));
    const create = await app.inject({ method: 'POST', url: '/api/v1/sip-trunks', headers: { authorization: `Bearer ${token1}` }, payload: validBody() });
    const id = create.json<{ data: { id: string } }>().data.id;
    const res = await app.inject({ method: 'GET', url: `/api/v1/sip-trunks/${id}`, headers: { authorization: `Bearer ${token2}` } });
    expect(res.statusCode).toBe(404);
  });
});
