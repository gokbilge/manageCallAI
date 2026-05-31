import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('RBAC capability matrix + tenant isolation', () => {
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

  function s(): string {
    return randomUUID().slice(0, 8);
  }

  function decodeJwt(token: string): { sub: string; tenant_id: string; email: string; role?: string } {
    const [, payload] = token.split('.');
    return JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8')) as {
      sub: string;
      tenant_id: string;
      email: string;
      role?: string;
    };
  }

  async function register(slug: string, email: string): Promise<string> {
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
    expect(res.statusCode, `register failed: ${res.body}`).toBe(201);
    return res.json<{ token: string }>().token;
  }

  async function login(slug: string, email: string, password = 'Secret123!'): Promise<string | undefined> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { tenant_slug: slug, email, password },
    });
    if (res.statusCode !== 200) return undefined;
    return res.json<{ token: string }>().token;
  }

  interface TenantContext {
    slug: string;
    adminToken: string;
    operatorToken: string;
    viewerToken: string;
    tenantId: string;
    adminUserId: string;
  }

  async function setupAllRoles(id: string): Promise<TenantContext> {
    const slug = `matrix-${id}`;
    const adminEmail = `admin-${id}@example.com`;
    const operatorEmail = `operator-${id}@example.com`;
    const viewerEmail = `viewer-${id}@example.com`;

    const adminToken = await register(slug, adminEmail);
    const { tenant_id: tenantId, sub: adminUserId } = decodeJwt(adminToken);

    await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { email: operatorEmail, display_name: 'Operator', role: 'tenant_operator', password: 'Secret123!' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { email: viewerEmail, display_name: 'Viewer', role: 'tenant_viewer', password: 'Secret123!' },
    });

    const operatorToken = (await login(slug, operatorEmail))!;
    const viewerToken = (await login(slug, viewerEmail))!;

    return { slug, adminToken, operatorToken, viewerToken, tenantId, adminUserId };
  }

  // ── Extensions RBAC matrix ────────────────────────────────────────────────

  describe('extensions RBAC matrix', () => {
    it('tenant_viewer can list but cannot create or deactivate extensions', async () => {
      const { adminToken, viewerToken } = await setupAllRoles(s());

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/extensions',
        headers: { authorization: `Bearer ${viewerToken}` },
      });
      expect(listRes.statusCode).toBe(200);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/extensions',
        headers: { authorization: `Bearer ${viewerToken}` },
        payload: { extension_number: '100', display_name: 'Ext', sip_password: 'Pass123!' },
      });
      expect(createRes.statusCode).toBe(403);

      const ext = await app.inject({
        method: 'POST',
        url: '/api/v1/extensions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { extension_number: '100', display_name: 'Ext', sip_password: 'Pass123!' },
      });
      const extId = ext.json<{ data: { id: string } }>().data.id;

      const deactivateRes = await app.inject({
        method: 'POST',
        url: `/api/v1/extensions/${extId}/deactivate`,
        headers: { authorization: `Bearer ${viewerToken}` },
      });
      expect(deactivateRes.statusCode).toBe(403);
    });

    it('tenant_operator can create and update but cannot deactivate extensions', async () => {
      const { operatorToken } = await setupAllRoles(s());

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/extensions',
        headers: { authorization: `Bearer ${operatorToken}` },
        payload: { extension_number: '200', display_name: 'Desk', sip_password: 'Pass123!' },
      });
      expect(createRes.statusCode).toBe(201);
      const extId = createRes.json<{ data: { id: string } }>().data.id;

      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/extensions/${extId}`,
        headers: { authorization: `Bearer ${operatorToken}` },
        payload: { display_name: 'Updated Desk' },
      });
      expect(patchRes.statusCode).toBe(200);

      const deactivateRes = await app.inject({
        method: 'POST',
        url: `/api/v1/extensions/${extId}/deactivate`,
        headers: { authorization: `Bearer ${operatorToken}` },
      });
      expect(deactivateRes.statusCode).toBe(403);
    });

    it('tenant_admin can deactivate extensions', async () => {
      const { adminToken } = await setupAllRoles(s());

      const ext = await app.inject({
        method: 'POST',
        url: '/api/v1/extensions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { extension_number: '300', display_name: 'Admin Ext', sip_password: 'Pass123!' },
      });
      const extId = ext.json<{ data: { id: string } }>().data.id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/extensions/${extId}/deactivate`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: { status: string } }>().data.status).toBe('inactive');
    });
  });

  // ── IVR flows RBAC matrix ─────────────────────────────────────────────────

  describe('IVR flows RBAC matrix', () => {
    const validDef = {
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'end' },
        { id: 'end', type: 'hangup' },
      ],
    };

    it('tenant_viewer can list and view flows but cannot create them', async () => {
      const { adminToken, viewerToken } = await setupAllRoles(s());

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${viewerToken}` },
      });
      expect(listRes.statusCode).toBe(200);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${viewerToken}` },
        payload: { name: 'Flow', graph_json: validDef },
      });
      expect(createRes.statusCode).toBe(403);

      const flow = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Admin Flow', graph_json: validDef },
      });
      const flowId = flow.json<{ data: { id: string } }>().data.id;

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-flows/${flowId}`,
        headers: { authorization: `Bearer ${viewerToken}` },
      });
      expect(getRes.statusCode).toBe(200);
    });

    it('tenant_operator can create and validate but cannot publish IVR flows', async () => {
      const { operatorToken } = await setupAllRoles(s());

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${operatorToken}` },
        payload: { name: 'Op Flow', graph_json: validDef },
      });
      expect(createRes.statusCode).toBe(201);
      const flow = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;

      const validateRes = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/validate`,
        headers: { authorization: `Bearer ${operatorToken}` },
      });
      expect(validateRes.statusCode).toBe(200);

      const publishRes = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/versions/${flow.versions[0]!.id}/publish`,
        headers: { authorization: `Bearer ${operatorToken}` },
      });
      expect(publishRes.statusCode).toBe(403);
    });

    it('tenant_admin can publish and rollback IVR flows', async () => {
      const { adminToken } = await setupAllRoles(s());

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Publish Flow', graph_json: validDef },
      });
      const flow = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
      const vid = flow.versions[0]!.id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/versions/${vid}/validate`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const publishRes = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/versions/${vid}/publish`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(publishRes.statusCode).toBe(200);
      expect(publishRes.json<{ data: { status: string } }>().data.status).toBe('published');
    });
  });

  // ── API key capability enforcement ────────────────────────────────────────

  describe('API key capability enforcement', () => {
    // Create an API key via the HTTP endpoint (avoids DB INSERT isolation issues).
    // Not specifying capabilities defaults to the full wildcard key ('*').
    async function makeApiKey(adminToken: string, capabilities?: string[]): Promise<{ key: string; id: string }> {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/automation/keys',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Test Key', ...(capabilities ? { capabilities } : {}) },
      });
      expect(res.statusCode, `createApiKey failed: ${res.body}`).toBe(201);
      const data = res.json<{ data: { key: string; id: string } }>().data;
      return { key: data.key, id: data.id };
    }

    it('API key with only view capability cannot create extensions', async () => {
      const { adminToken } = await setupAllRoles(s());
      const { key: viewKey } = await makeApiKey(adminToken, ['tenant.extensions.view']);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/extensions',
        headers: { authorization: `Bearer ${viewKey}` },
        payload: { extension_number: '500', display_name: 'Key Ext', sip_password: 'Pass123!' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('API key with IVR view capability can list IVR flows (requireCapability endpoint)', async () => {
      // GET /extensions uses the JWT-only `authenticate` hook, not `requireCapability`.
      // Use GET /ivr-flows which uses requireCapability(TENANT_IVR_FLOWS_VIEW) to
      // verify that API key authentication works for read-level access.
      const { adminToken } = await setupAllRoles(s());
      const { key: ivrViewKey } = await makeApiKey(adminToken, ['tenant.ivr_flows.view']);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${ivrViewKey}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('API key without explicit capabilities (wildcard default) can create extensions', async () => {
      const { adminToken } = await setupAllRoles(s());
      const { key: wildcardKey } = await makeApiKey(adminToken);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/extensions',
        headers: { authorization: `Bearer ${wildcardKey}` },
        payload: { extension_number: '600', display_name: 'Wild Ext', sip_password: 'Pass123!' },
      });
      expect(res.statusCode).toBe(201);
    });

    it('revoked API key returns 401 on requireCapability-protected endpoints', async () => {
      const { adminToken } = await setupAllRoles(s());
      const { key: rawKey, id: keyId } = await makeApiKey(adminToken, ['tenant.ivr_flows.view']);

      // Verify the key works before revocation
      const beforeRevoke = await app.inject({
        method: 'GET',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${rawKey}` },
      });
      expect(beforeRevoke.statusCode).toBe(200);

      // Revoke via HTTP endpoint
      const revokeRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/automation/keys/${keyId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect([200, 204], `revoke returned ${revokeRes.statusCode}: ${revokeRes.body}`).toContain(revokeRes.statusCode);

      // After revocation the key should be rejected
      const afterRevoke = await app.inject({
        method: 'GET',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${rawKey}` },
      });
      expect(afterRevoke.statusCode).toBe(401);
    });

    it('API key with validate/simulate but no publish capability cannot publish IVR flows', async () => {
      const { adminToken } = await setupAllRoles(s());
      const { key: ivrKey } = await makeApiKey(adminToken, [
        'tenant.ivr_flows.view',
        'tenant.ivr_flows.update',
        'tenant.ivr_flows.validate',
        'tenant.ivr_flows.simulate',
      ]);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Key Flow',
          graph_json: { entry_node_id: 's', nodes: [{ id: 's', type: 'hangup' }] },
        },
      });
      expect(createRes.statusCode).toBe(201);
      const flow = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;

      const validateRes = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/validate`,
        headers: { authorization: `Bearer ${ivrKey}` },
      });
      expect(validateRes.statusCode).toBe(200);

      const publishRes = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/versions/${flow.versions[0]!.id}/publish`,
        headers: { authorization: `Bearer ${ivrKey}` },
      });
      expect(publishRes.statusCode).toBe(403);
    });
  });

  // ── platform_admin JWT ────────────────────────────────────────────────────
  //
  // config.platformOperatorEmails is read at module load time, so we cannot
  // change it by mutating process.env after buildApp(). Instead, we sign a
  // platform_admin JWT directly with app.jwt.sign() and verify it passes
  // requireCapability checks (which are role-based, not email-list-based).

  describe('platform_admin JWT', () => {
    it('platform_admin JWT has all tenant capabilities (can deactivate extensions)', async () => {
      const { adminUserId, tenantId } = await setupAllRoles(s());

      const platformToken = app.jwt.sign({
        sub: adminUserId,
        tenant_id: tenantId,
        email: 'platform@internal',
        role: 'platform_admin' as const,
      });

      const extRes = await app.inject({
        method: 'POST',
        url: '/api/v1/extensions',
        headers: { authorization: `Bearer ${platformToken}` },
        payload: { extension_number: '999', display_name: 'Plat Ext', sip_password: 'Pass123!' },
      });
      expect(extRes.statusCode).toBe(201);
      const extId = extRes.json<{ data: { id: string } }>().data.id;

      const deactivateRes = await app.inject({
        method: 'POST',
        url: `/api/v1/extensions/${extId}/deactivate`,
        headers: { authorization: `Bearer ${platformToken}` },
      });
      expect(deactivateRes.statusCode).toBe(200);
    });

    it('platform_admin JWT can publish IVR flows (highest-privilege tenant action)', async () => {
      const { adminToken, adminUserId, tenantId } = await setupAllRoles(s());

      const platformToken = app.jwt.sign({
        sub: adminUserId,
        tenant_id: tenantId,
        email: 'platform@internal',
        role: 'platform_admin' as const,
      });

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Platform Flow',
          graph_json: { entry_node_id: 's', nodes: [{ id: 's', type: 'hangup' }] },
        },
      });
      const flow = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;

      await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/versions/${flow.versions[0]!.id}/validate`,
        headers: { authorization: `Bearer ${platformToken}` },
      });

      const publishRes = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/versions/${flow.versions[0]!.id}/publish`,
        headers: { authorization: `Bearer ${platformToken}` },
      });
      expect(publishRes.statusCode).toBe(200);
    });
  });

  // ── Cross-tenant isolation matrix ─────────────────────────────────────────

  describe('cross-tenant isolation matrix', () => {
    it('tenant A extension list does not include tenant B extensions', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`iso-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`iso-b-${sB}`, `admin-b-${sB}@example.com`);

      await app.inject({
        method: 'POST',
        url: '/api/v1/extensions',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { extension_number: '700', display_name: 'Tenant B Ext', sip_password: 'Pass123!' },
      });

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/extensions',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json<{ data: unknown[] }>().data).toHaveLength(0);
    });

    it('tenant A cannot get tenant B extension by ID', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`xiso-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`xiso-b-${sB}`, `admin-b-${sB}@example.com`);

      const extB = await app.inject({
        method: 'POST',
        url: '/api/v1/extensions',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { extension_number: '800', display_name: 'B Ext', sip_password: 'Pass123!' },
      });
      const extBId = extB.json<{ data: { id: string } }>().data.id;

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/extensions/${extBId}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(getRes.statusCode).toBe(404);
    });

    it('tenant A IVR flow list does not include tenant B flows', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`flow-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`flow-b-${sB}`, `admin-b-${sB}@example.com`);

      await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: {
          name: 'Tenant B Flow',
          graph_json: { entry_node_id: 'start', nodes: [{ id: 'start', type: 'hangup' }] },
        },
      });

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json<{ data: unknown[] }>().data).toHaveLength(0);
    });

    it('unauthenticated requests return 401 for all protected resources', async () => {
      for (const url of ['/api/v1/extensions', '/api/v1/ivr-flows', '/api/v1/users', '/api/v1/sip-trunks']) {
        const res = await app.inject({ method: 'GET', url });
        expect(res.statusCode, `expected 401 for ${url}`).toBe(401);
      }
    });

    it('API key from tenant A only sees tenant A IVR flows, not tenant B flows', async () => {
      // GET /ivr-flows uses requireCapability(TENANT_IVR_FLOWS_VIEW) — accepts API keys.
      const sA = s();
      const sB = s();
      const tokenA = await register(`keyiso-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`keyiso-b-${sB}`, `admin-b-${sB}@example.com`);

      // Create one IVR flow in each tenant
      await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { name: 'Tenant A Flow', graph_json: { entry_node_id: 's', nodes: [{ id: 's', type: 'hangup' }] } },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { name: 'Tenant B Flow', graph_json: { entry_node_id: 's', nodes: [{ id: 's', type: 'hangup' }] } },
      });

      // Create API key for tenant A (wildcard = no capabilities specified)
      const keyRes = await app.inject({
        method: 'POST',
        url: '/api/v1/automation/keys',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { name: 'Isolation Test Key' },
      });
      expect(keyRes.statusCode).toBe(201);
      const apiKey = keyRes.json<{ data: { key: string } }>().data.key;

      // Tenant A's API key must only return tenant A's flows
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${apiKey}` },
      });
      expect(listRes.statusCode).toBe(200);
      const flows = listRes.json<{ data: Array<{ name: string }> }>().data;
      expect(flows).toHaveLength(1);
      expect(flows[0]?.name).toBe('Tenant A Flow');
    });
  });
});
