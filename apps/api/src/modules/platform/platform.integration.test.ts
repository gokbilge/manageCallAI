import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

const PLATFORM_EMAIL = 'platform-operator@test.com';

describe('Platform API integration', () => {
  let app: FastifyInstance;
  let db: Pool;

  beforeAll(async () => {
    process.env.RUNTIME_API_TOKEN ??= 'test-runtime-token';
    process.env.JWT_SECRET ??= 'test-jwt-secret';
    process.env.SIP_SECRET_MASTER_KEY ??=
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.SIP_SECRET_KEY_ID ??= 'test-v1';
    process.env.PLATFORM_OPERATOR_EMAILS = PLATFORM_EMAIL;

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

  async function registerUser(slug: string, email: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: `Tenant ${slug}`,
        tenant_slug: slug,
        email,
        display_name: 'Test User',
        password: 'Secret123!',
      },
    });
    return res.json<{ token: string }>().token;
  }

  // ── platform/tenants ────────────────────────────────────────────────────

  it('GET /platform/tenants → 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/platform/tenants' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /platform/tenants → 403 for ordinary tenant JWT', async () => {
    const suffix = randomUUID().slice(0, 8);
    const token = await registerUser(`regular-${suffix}`, `regular-${suffix}@example.com`);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/platform/tenants',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /platform/tenants → 200 with tenant list for platform operator', async () => {
    const suffix = randomUUID().slice(0, 8);
    const token = await registerUser(`platform-${suffix}`, PLATFORM_EMAIL);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/platform/tenants',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: Record<string, unknown>[] }>();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String),
      directory_domain: expect.any(String),
      status: 'active',
      created_at: expect.any(String),
      updated_at: expect.any(String),
    });
    expect(res.body).not.toContain('password');
    expect(res.body).not.toContain('hash');
  });

  // ── platform/runtime/health ─────────────────────────────────────────────

  it('GET /platform/runtime/health → 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/platform/runtime/health' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /platform/runtime/health → 403 for ordinary tenant JWT', async () => {
    const suffix = randomUUID().slice(0, 8);
    const token = await registerUser(`regular2-${suffix}`, `regular2-${suffix}@example.com`);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/platform/runtime/health',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /platform/runtime/health → 200 with services array, healthy api + unreachable worker', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes('3000')) {
        return new Response('{"status":"ok","db":"ok"}', { status: 200 });
      }
      throw new Error('ECONNREFUSED');
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const suffix = randomUUID().slice(0, 8);
      const token = await registerUser(`platform2-${suffix}`, PLATFORM_EMAIL);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/platform/runtime/health',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { services: { name: string; status: string; url: string; detail: string }[] } }>();
      expect(Array.isArray(body.data.services)).toBe(true);
      expect(body.data.services).toHaveLength(2);

      const api = body.data.services.find((s) => s.name === 'api');
      const worker = body.data.services.find((s) => s.name === 'worker');

      expect(api).toMatchObject({ name: 'api', status: 'healthy', url: expect.any(String), detail: expect.any(String) });
      expect(worker).toMatchObject({ name: 'worker', status: 'unreachable', url: expect.any(String), detail: 'connection failed' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('GET /platform/runtime/health → 200 even when both services are unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));

    try {
      const suffix = randomUUID().slice(0, 8);
      const token = await registerUser(`platform3-${suffix}`, PLATFORM_EMAIL);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/platform/runtime/health',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { services: { status: string }[] } }>();
      expect(body.data.services.every((s) => s.status === 'unreachable')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
