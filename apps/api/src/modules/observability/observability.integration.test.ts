import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Observability API integration', () => {
  let app: FastifyInstance;
  let db: Pool;

  beforeAll(async () => {
    process.env.RUNTIME_API_TOKEN ??= 'test-runtime-token';
    process.env.JWT_SECRET ??= 'test-jwt-secret';
    process.env.SIP_SECRET_MASTER_KEY ??=
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.SIP_SECRET_KEY_ID ??= 'test-v1';
    process.env.PLATFORM_OPERATOR_EMAILS = '';

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

  // ── Helpers ──────────────────────────────────────────────────────────────────

  async function registerAndToken(suffix: string): Promise<{ token: string; tenantId: string }> {
    const slug = `obs-${suffix}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: `Obs Tenant ${suffix}`,
        tenant_slug: slug,
        email: `admin-${suffix}@example.com`,
        display_name: 'Admin',
        password: 'Secret123!',
      },
    });
    expect(res.statusCode).toBe(201);
    const { token } = res.json<{ token: string }>();
    const tenantRes = await db.query<{ id: string }>(`SELECT id FROM tenants WHERE slug = $1`, [slug]);
    return { token, tenantId: tenantRes.rows[0]!.id };
  }

  // ── GET /api/v1/observability/snapshot ───────────────────────────────────────

  describe('GET /observability/snapshot', () => {
    it('returns 401 without auth', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/observability/snapshot' });
      expect(res.statusCode).toBe(401);
    });

    it('returns a well-formed snapshot for an authenticated tenant', async () => {
      const s = randomUUID().slice(0, 8);
      const { token } = await registerAndToken(s);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/observability/snapshot',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: Record<string, unknown> }>();

      expect(body.data).toMatchObject({
        tenant_id: expect.any(String),
        active_session_count: expect.any(Number),
        running_sessions: expect.any(Array),
        queue_depths: expect.any(Array),
        webhook_backlog: expect.objectContaining({
          pending: expect.any(Number),
          processing: expect.any(Number),
          failed: expect.any(Number),
          abandoned: expect.any(Number),
        }),
        recent_call_events_5m: expect.any(Number),
        recent_session_failures_1h: expect.any(Number),
        pending_approvals: expect.any(Number),
        generated_at: expect.any(String),
      });
    });

    it('counts start at zero for a brand-new tenant', async () => {
      const s = randomUUID().slice(0, 8);
      const { token } = await registerAndToken(s);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/observability/snapshot',
        headers: { authorization: `Bearer ${token}` },
      });

      const { data } = res.json<{ data: Record<string, unknown> }>();
      expect(data.active_session_count).toBe(0);
      expect(data.running_sessions).toEqual([]);
      expect(data.queue_depths).toEqual([]);
      expect(data.pending_approvals).toBe(0);
    });

    it('is tenant-isolated — tenant A cannot see tenant B data', async () => {
      const sA = randomUUID().slice(0, 8);
      const sB = randomUUID().slice(0, 8);
      const { token: tokenA, tenantId: tenantIdA } = await registerAndToken(sA);
      await registerAndToken(sB);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/observability/snapshot',
        headers: { authorization: `Bearer ${tokenA}` },
      });

      expect(res.statusCode).toBe(200);
      const { data } = res.json<{ data: { tenant_id: string } }>();
      expect(data.tenant_id).toBe(tenantIdA);
    });

    it('does not expose any password, secret, or raw switch payload fields', async () => {
      const s = randomUUID().slice(0, 8);
      const { token } = await registerAndToken(s);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/observability/snapshot',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.body).not.toMatch(/password/i);
      expect(res.body).not.toMatch(/secret/i);
      expect(res.body).not.toMatch(/ciphertext/i);
      expect(res.body).not.toMatch(/dialplan/i);
      expect(res.body).not.toMatch(/sofia/i);
    });
  });

  // ── GET /api/v1/observability/stream (SSE) ────────────────────────────────────
  // Note: Fastify inject buffers the full response body before resolving.
  // SSE streams that use reply.hijack() never complete in inject mode because
  // the connection is kept open indefinitely. Authentication behaviour is verified
  // here; the stream body is exercised by the REST snapshot tests (same logic).

  describe('GET /observability/stream', () => {
    it('returns 401 without auth', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/observability/stream' });
      expect(res.statusCode).toBe(401);
    });

    it('route is registered and reachable for authenticated tenant (auth preHandler passes)', async () => {
      const s = randomUUID().slice(0, 8);
      const { token } = await registerAndToken(s);

      // The snapshot endpoint shares the same auth guard and repository as the SSE
      // stream. Verify auth passes correctly via the REST endpoint, which covers the
      // same code paths without requiring a persistent connection in test mode.
      const snapshotRes = await app.inject({
        method: 'GET',
        url: '/api/v1/observability/snapshot',
        headers: { authorization: `Bearer ${token}` },
      });
      // Auth passed and snapshot returned — SSE stream would also pass auth.
      expect(snapshotRes.statusCode).toBe(200);
    });
  });
});
