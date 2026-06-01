/**
 * Runtime actor boundary tests.
 *
 * Verifies the hard separation between the runtime channel (Bearer/Basic
 * RUNTIME_API_TOKEN) and the user channel (JWT / API key). These tests guard
 * against:
 *   - A compromised runtime token being used to call normal tenant CRUD
 *   - A normal user JWT being accepted on runtime-only ingest endpoints
 *   - Tenant ID confusion between the x-tenant-id header and JWT claims
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Runtime actor boundary', () => {
  let app: FastifyInstance;
  let db: Pool;
  const runtimeToken = 'test-runtime-token';

  beforeAll(async () => {
    process.env.RUNTIME_API_TOKEN = runtimeToken;
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

  async function register(suffix: string): Promise<{ token: string; tenantId: string }> {
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
    expect(res.statusCode, `register failed: ${res.body}`).toBe(201);
    const token = res.json<{ token: string }>().token;
    const [, payload] = token.split('.');
    const { tenant_id: tenantId } = JSON.parse(
      Buffer.from(payload!, 'base64url').toString('utf8'),
    ) as { tenant_id: string };
    return { token, tenantId };
  }

  // ── Runtime token must not access user-facing endpoints ───────────────────

  describe('runtime token cannot access user-facing endpoints', () => {
    it('runtime Bearer token rejected on GET /extensions (requires JWT)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/extensions',
        headers: { authorization: `Bearer ${runtimeToken}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('runtime Bearer token rejected on POST /extensions (requires JWT capability)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/extensions',
        headers: { authorization: `Bearer ${runtimeToken}` },
        payload: { extension_number: '100', display_name: 'Ext', sip_password: 'Pass123!' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('runtime Bearer token rejected on GET /ivr-flows (requires JWT capability)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${runtimeToken}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('runtime Bearer token rejected on GET /users (requires JWT capability)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${runtimeToken}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('runtime Bearer token rejected on GET /sip-trunks', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/sip-trunks',
        headers: { authorization: `Bearer ${runtimeToken}` },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── User JWT must not access runtime-only ingest endpoints ────────────────

  describe('user JWT cannot call runtime ingest without runtime token', () => {
    it('user JWT rejected on POST /call-events/internal/ingest (requires runtime token)', async () => {
      const { token, tenantId } = await register(randomUUID().slice(0, 8));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/call-events/internal/ingest',
        headers: {
          authorization: `Bearer ${token}`,
          'x-tenant-id': tenantId,
        },
        payload: { tenant_id: tenantId, call_id: 'call-1', event_type: 'channel_create' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('no auth on /call-events/internal/ingest returns 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/call-events/internal/ingest',
        payload: { tenant_id: randomUUID(), call_id: 'call-1', event_type: 'channel_create' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── Runtime ingest correctly enforced ─────────────────────────────────────

  describe('runtime token ingest enforcement', () => {
    it('runtime token with correct tenant header ingests successfully', async () => {
      const { tenantId } = await register(randomUUID().slice(0, 8));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/call-events/internal/ingest',
        headers: {
          authorization: `Bearer ${runtimeToken}`,
          'x-tenant-id': tenantId,
        },
        payload: { tenant_id: tenantId, call_id: 'call-ok', event_type: 'channel_create' },
      });
      expect(res.statusCode).toBe(201);
    });

    it('runtime token with mismatched x-tenant-id vs body tenant_id returns 400', async () => {
      const { tenantId } = await register(randomUUID().slice(0, 8));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/call-events/internal/ingest',
        headers: {
          authorization: `Bearer ${runtimeToken}`,
          'x-tenant-id': randomUUID(),
        },
        payload: { tenant_id: tenantId, call_id: 'call-mismatch', event_type: 'channel_create' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('wrong runtime token returns 401 on ingest', async () => {
      const { tenantId } = await register(randomUUID().slice(0, 8));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/call-events/internal/ingest',
        headers: {
          authorization: 'Bearer wrong-token',
          'x-tenant-id': tenantId,
        },
        payload: { tenant_id: tenantId, call_id: 'call-bad', event_type: 'channel_create' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── Runtime FreeSWITCH endpoints ──────────────────────────────────────────

  describe('FreeSWITCH runtime endpoints enforce runtime auth', () => {
    it('GET /freeswitch/directory without runtime auth returns 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/freeswitch/directory?user=100&domain=tenant.managecallai.local',
      });
      expect(res.statusCode).toBe(401);
    });

    it('user JWT rejected on /freeswitch/directory (requires runtime token)', async () => {
      const { token } = await register(randomUUID().slice(0, 8));

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/freeswitch/directory?user=100&domain=tenant.managecallai.local',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(401);
    });

    it('Basic auth with runtime token is accepted on /freeswitch/directory', async () => {
      const { token, tenantId } = await register(randomUUID().slice(0, 8));

      await app.inject({
        method: 'POST',
        url: '/api/v1/extensions',
        headers: { authorization: `Bearer ${token}` },
        payload: { extension_number: '200', display_name: 'Test', sip_password: 'TestPass123!' },
      });

      const slug = `tenant-${tenantId.slice(0, 8)}`;
      const domain = `${slug}.managecallai.local`;
      const basicAuth = 'Basic ' + Buffer.from(`fs:${runtimeToken}`).toString('base64');

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/freeswitch/directory?user=200&domain=${domain}`,
        headers: { authorization: basicAuth },
      });
      // 200 (found) or 404 (extension not in this slug's domain) — either is fine
      // as long as it's NOT 401
      expect(res.statusCode).not.toBe(401);
    });
  });
});
