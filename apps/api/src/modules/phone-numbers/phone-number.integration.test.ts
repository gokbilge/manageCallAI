import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Phone Numbers API integration', () => {
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

  it('GET /phone-numbers → 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/phone-numbers' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /phone-numbers → creates number', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/phone-numbers',
      headers: { authorization: `Bearer ${token}` },
      payload: { e164_number: '+15551234567', display_label: 'Main Line' },
    });
    expect(res.statusCode).toBe(201);
    const { data } = res.json<{ data: Record<string, unknown> }>();
    expect(data['e164_number']).toBe('+15551234567');
    expect(data['display_label']).toBe('Main Line');
    expect(data['status']).toBe('active');
    expect(data['trunk_id']).toBeNull();
    expect(data['assigned_target_type']).toBeNull();
  });

  it('GET /phone-numbers → lists tenant numbers', async () => {
    const token = await register(randomUUID().slice(0, 8));
    await app.inject({ method: 'POST', url: '/api/v1/phone-numbers', headers: { authorization: `Bearer ${token}` }, payload: { e164_number: '+15550000001' } });
    await app.inject({ method: 'POST', url: '/api/v1/phone-numbers', headers: { authorization: `Bearer ${token}` }, payload: { e164_number: '+15550000002' } });
    const res = await app.inject({ method: 'GET', url: '/api/v1/phone-numbers', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: unknown[] }>().data).toHaveLength(2);
  });

  it('GET /phone-numbers/:id → 404 for unknown id', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({ method: 'GET', url: `/api/v1/phone-numbers/${randomUUID()}`, headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /phone-numbers/:id → updates display_label', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const create = await app.inject({ method: 'POST', url: '/api/v1/phone-numbers', headers: { authorization: `Bearer ${token}` }, payload: { e164_number: '+15559990001' } });
    const id = create.json<{ data: { id: string } }>().data.id;
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/phone-numbers/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { display_label: 'Updated Label' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: { display_label: string } }>().data.display_label).toBe('Updated Label');
  });

  it('POST /phone-numbers/:id/deactivate → deactivates number', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const create = await app.inject({ method: 'POST', url: '/api/v1/phone-numbers', headers: { authorization: `Bearer ${token}` }, payload: { e164_number: '+15559990002' } });
    const id = create.json<{ data: { id: string } }>().data.id;
    const res = await app.inject({ method: 'POST', url: `/api/v1/phone-numbers/${id}/deactivate`, headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: { status: string } }>().data.status).toBe('inactive');
  });

  it('tenant isolation: cannot see another tenant number', async () => {
    const token1 = await register(randomUUID().slice(0, 8));
    const token2 = await register(randomUUID().slice(0, 8));
    const create = await app.inject({ method: 'POST', url: '/api/v1/phone-numbers', headers: { authorization: `Bearer ${token1}` }, payload: { e164_number: '+15551111111' } });
    const id = create.json<{ data: { id: string } }>().data.id;
    const res = await app.inject({ method: 'GET', url: `/api/v1/phone-numbers/${id}`, headers: { authorization: `Bearer ${token2}` } });
    expect(res.statusCode).toBe(404);
  });
});
