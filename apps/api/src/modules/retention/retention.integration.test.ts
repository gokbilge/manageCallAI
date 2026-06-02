/**
 * Retention API integration tests.
 *
 * Verifies:
 * - GET/PATCH /api/v1/tenant/retention: read, update, bounds validation.
 * - GET /api/v1/tenant/legal-holds: list active and all holds.
 * - POST /api/v1/tenant/legal-hold: create a hold.
 * - DELETE /api/v1/tenant/legal-hold/:id: release a hold.
 * - Capability gating: tenant_operator cannot manage compliance.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Retention API', () => {
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

  async function registerAdmin(suffix: string): Promise<{ token: string; tenantId: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: `Retention Tenant ${suffix}`,
        tenant_slug: `ret-${suffix}`,
        email: `admin-${suffix}@example.com`,
        display_name: 'Admin',
        password: 'Secret123!',
      },
    });
    const token = res.json<{ token: string }>().token;
    const tenantId = JSON.parse(
      Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8'),
    ).tenant_id as string;
    return { token, tenantId };
  }

  async function makeOperatorToken(app: FastifyInstance, adminToken: string, slug: string, suffix: string): Promise<string> {
    await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: `op-${suffix}@example.com`,
        display_name: 'Operator',
        role: 'tenant_operator',
        password: 'Secret123!',
      },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { tenant_slug: slug, email: `op-${suffix}@example.com`, password: 'Secret123!' },
    });
    return loginRes.json<{ token: string }>().token;
  }

  // ── Retention policy ──────────────────────────────────────────────────────

  describe('GET /api/v1/tenant/retention', () => {
    it('returns null data when no policy is set', async () => {
      const { token } = await registerAdmin(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenant/retention',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: unknown }>().data).toBeNull();
    });

    it('returns policy after update', async () => {
      const { token } = await registerAdmin(randomUUID().slice(0, 8));
      await app.inject({
        method: 'PATCH',
        url: '/api/v1/tenant/retention',
        headers: { authorization: `Bearer ${token}` },
        payload: { recording_retention_days: 180 },
      });
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenant/retention',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: { recording_retention_days: number } }>().data.recording_retention_days).toBe(180);
    });

    it('tenant_operator cannot access retention policy', async () => {
      const s = randomUUID().slice(0, 8);
      const slug = `ret-op-${s}`;
      const adminRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          tenant_name: 'Ret Op Tenant',
          tenant_slug: slug,
          email: `op-admin-${s}@example.com`,
          display_name: 'Admin',
          password: 'Secret123!',
        },
      });
      const adminToken = adminRes.json<{ token: string }>().token;
      const opToken = await makeOperatorToken(app, adminToken, slug, s);
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenant/retention',
        headers: { authorization: `Bearer ${opToken}` },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('PATCH /api/v1/tenant/retention', () => {
    it('creates retention policy for tenant', async () => {
      const { token } = await registerAdmin(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/tenant/retention',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          recording_retention_days: 90,
          cdr_retention_days: 365,
        },
      });
      expect(res.statusCode).toBe(200);
      const data = res.json<{ data: { recording_retention_days: number; cdr_retention_days: number } }>().data;
      expect(data.recording_retention_days).toBe(90);
      expect(data.cdr_retention_days).toBe(365);
    });

    it('rejects out-of-bounds values', async () => {
      const { token } = await registerAdmin(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/tenant/retention',
        headers: { authorization: `Bearer ${token}` },
        payload: { cdr_retention_days: 5 }, // min is 30
      });
      expect(res.statusCode).toBe(400);
    });

    it('partial update preserves existing values', async () => {
      const { token } = await registerAdmin(randomUUID().slice(0, 8));
      await app.inject({
        method: 'PATCH',
        url: '/api/v1/tenant/retention',
        headers: { authorization: `Bearer ${token}` },
        payload: { recording_retention_days: 60, cdr_retention_days: 365 },
      });
      await app.inject({
        method: 'PATCH',
        url: '/api/v1/tenant/retention',
        headers: { authorization: `Bearer ${token}` },
        payload: { recording_retention_days: 120 },
      });
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenant/retention',
        headers: { authorization: `Bearer ${token}` },
      });
      const data = res.json<{ data: { recording_retention_days: number; cdr_retention_days: number } }>().data;
      expect(data.recording_retention_days).toBe(120);
      expect(data.cdr_retention_days).toBe(365);
    });
  });

  // ── Legal holds ───────────────────────────────────────────────────────────

  describe('POST /api/v1/tenant/legal-hold', () => {
    it('creates a legal hold', async () => {
      const { token } = await registerAdmin(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenant/legal-hold',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          resource_type: 'recording',
          reason: 'Litigation hold for case XYZ-2026',
          case_reference: 'XYZ-2026',
        },
      });
      expect(res.statusCode).toBe(201);
      const hold = res.json<{ data: { status: string; resource_type: string } }>().data;
      expect(hold.status).toBe('active');
      expect(hold.resource_type).toBe('recording');
    });

    it('creates an all-resources hold', async () => {
      const { token } = await registerAdmin(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenant/legal-hold',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          resource_type: 'all',
          reason: 'Regulatory investigation hold',
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json<{ data: { resource_type: string } }>().data.resource_type).toBe('all');
    });
  });

  describe('GET /api/v1/tenant/legal-holds', () => {
    it('lists active holds only by default', async () => {
      const { token } = await registerAdmin(randomUUID().slice(0, 8));
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tenant/legal-hold',
        headers: { authorization: `Bearer ${token}` },
        payload: { resource_type: 'cdr', reason: 'Audit hold' },
      });
      const holdId = createRes.json<{ data: { id: string } }>().data.id;
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/tenant/legal-hold/${holdId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/tenant/legal-hold',
        headers: { authorization: `Bearer ${token}` },
        payload: { resource_type: 'voicemail', reason: 'Active hold' },
      });

      const activeRes = await app.inject({
        method: 'GET',
        url: '/api/v1/tenant/legal-holds',
        headers: { authorization: `Bearer ${token}` },
      });
      const activeHolds = activeRes.json<{ data: Array<{ status: string }> }>().data;
      expect(activeHolds.every((h) => h.status === 'active')).toBe(true);
      expect(activeHolds).toHaveLength(1);

      const allRes = await app.inject({
        method: 'GET',
        url: '/api/v1/tenant/legal-holds?all=true',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(allRes.json<{ data: unknown[] }>().data).toHaveLength(2);
    });
  });

  describe('DELETE /api/v1/tenant/legal-hold/:id', () => {
    it('releases an active hold', async () => {
      const { token } = await registerAdmin(randomUUID().slice(0, 8));
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tenant/legal-hold',
        headers: { authorization: `Bearer ${token}` },
        payload: { resource_type: 'transcript', reason: 'Release test' },
      });
      const holdId = createRes.json<{ data: { id: string } }>().data.id;

      const releaseRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/tenant/legal-hold/${holdId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(releaseRes.statusCode).toBe(200);
      expect(releaseRes.json<{ data: { status: string } }>().data.status).toBe('released');
    });

    it('returns 404 when releasing an already-released hold', async () => {
      const { token } = await registerAdmin(randomUUID().slice(0, 8));
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tenant/legal-hold',
        headers: { authorization: `Bearer ${token}` },
        payload: { resource_type: 'summary', reason: 'Double release test' },
      });
      const holdId = createRes.json<{ data: { id: string } }>().data.id;
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/tenant/legal-hold/${holdId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/tenant/legal-hold/${holdId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('cannot release another tenant hold', async () => {
      const s1 = randomUUID().slice(0, 8);
      const s2 = randomUUID().slice(0, 8);
      const { token: t1 } = await registerAdmin(s1);
      const { token: t2 } = await registerAdmin(s2);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tenant/legal-hold',
        headers: { authorization: `Bearer ${t1}` },
        payload: { resource_type: 'recording', reason: 'Cross-tenant test' },
      });
      const holdId = createRes.json<{ data: { id: string } }>().data.id;

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/tenant/legal-hold/${holdId}`,
        headers: { authorization: `Bearer ${t2}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
