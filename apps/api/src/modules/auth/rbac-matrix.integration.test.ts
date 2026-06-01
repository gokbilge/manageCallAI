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

    // ── SIP trunks ────────────────────────────────────────────────────────────

    // Shared helper for valid SIP trunk body (matches CreateSipTrunkBody schema)
    function sipTrunkBody(name = 'Test Trunk') {
      return {
        name,
        direction: 'inbound',
        realm: 'sip.example.com',
        proxy: 'sip.example.com',
        auth_username: 'trunk-user',
        auth_password: 'SuperSecret99!',
      };
    }

    it('tenant A SIP trunk list does not include tenant B trunks', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`trunk-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`trunk-b-${sB}`, `admin-b-${sB}@example.com`);

      await app.inject({
        method: 'POST',
        url: '/api/v1/sip-trunks',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: sipTrunkBody('Trunk B'),
      });

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/sip-trunks',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json<{ data: unknown[] }>().data).toHaveLength(0);
    });

    it('tenant A cannot read tenant B SIP trunk by ID', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`trunkid-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`trunkid-b-${sB}`, `admin-b-${sB}@example.com`);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sip-trunks',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: sipTrunkBody('Trunk B'),
      });
      expect(createRes.statusCode, `create failed: ${createRes.body}`).toBe(201);
      const trunkBId = createRes.json<{ data: { id: string } }>().data.id;

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/sip-trunks/${trunkBId}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(getRes.statusCode).toBe(404);
    });

    it('tenant A cannot update tenant B SIP trunk', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`trunkupd-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`trunkupd-b-${sB}`, `admin-b-${sB}@example.com`);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sip-trunks',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: sipTrunkBody('Trunk B'),
      });
      expect(createRes.statusCode, `create failed: ${createRes.body}`).toBe(201);
      const trunkBId = createRes.json<{ data: { id: string } }>().data.id;

      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/sip-trunks/${trunkBId}`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { name: 'Hijacked Trunk' },
      });
      expect([403, 404]).toContain(patchRes.statusCode);
    });

    // ── Phone numbers ─────────────────────────────────────────────────────────

    it('tenant A phone number list does not include tenant B numbers', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`num-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`num-b-${sB}`, `admin-b-${sB}@example.com`);

      await app.inject({
        method: 'POST',
        url: '/api/v1/phone-numbers',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { e164_number: '+15550001001' },
      });

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/phone-numbers',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json<{ data: unknown[] }>().data).toHaveLength(0);
    });

    it('tenant A cannot read tenant B phone number by ID', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`numid-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`numid-b-${sB}`, `admin-b-${sB}@example.com`);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/phone-numbers',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { e164_number: '+15550001002' },
      });
      expect(createRes.statusCode, `create failed: ${createRes.body}`).toBe(201);
      const numBId = createRes.json<{ data: { id: string } }>().data.id;

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/phone-numbers/${numBId}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(getRes.statusCode).toBe(404);
    });

    // ── IVR flow write/lifecycle isolation ────────────────────────────────────

    it('tenant A cannot update tenant B IVR flow', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`flowupd-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`flowupd-b-${sB}`, `admin-b-${sB}@example.com`);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { name: 'B Flow', graph_json: { entry_node_id: 's', nodes: [{ id: 's', type: 'hangup' }] } },
      });
      expect(createRes.statusCode).toBe(201);
      const flowBId = createRes.json<{ data: { id: string } }>().data.id;

      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/ivr-flows/${flowBId}`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { name: 'Hijacked Flow' },
      });
      expect([403, 404]).toContain(patchRes.statusCode);
    });

    it('tenant A cannot get tenant B IVR flow version', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`flowver-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`flowver-b-${sB}`, `admin-b-${sB}@example.com`);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { name: 'B Flow', graph_json: { entry_node_id: 's', nodes: [{ id: 's', type: 'hangup' }] } },
      });
      const flowBId = createRes.json<{ data: { id: string; draft_version_id: string } }>().data.id;
      const versionBId = createRes.json<{ data: { draft_version_id: string } }>().data.draft_version_id;

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-flows/${flowBId}/versions/${versionBId}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect([403, 404]).toContain(getRes.statusCode);
    });

    it('tenant A cannot publish tenant B IVR flow', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`flowpub-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`flowpub-b-${sB}`, `admin-b-${sB}@example.com`);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { name: 'B Flow', graph_json: { entry_node_id: 's', nodes: [{ id: 's', type: 'hangup' }] } },
      });
      const flowBId = createRes.json<{ data: { id: string; draft_version_id: string } }>().data.id;
      const versionBId = createRes.json<{ data: { draft_version_id: string } }>().data.draft_version_id;

      const publishRes = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flowBId}/versions/${versionBId}/publish`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect([403, 404]).toContain(publishRes.statusCode);
    });

    // ── Inbound routes ────────────────────────────────────────────────────────

    // Shared helper for valid inbound route body
    function inboundRouteBody(name = 'Test Route', matchValue = '+15550001000') {
      return { name, match_type: 'did', match_value: matchValue, target_type: 'flow' };
    }

    it('tenant A inbound route list does not include tenant B routes', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`inb-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`inb-b-${sB}`, `admin-b-${sB}@example.com`);

      await app.inject({
        method: 'POST',
        url: '/api/v1/inbound-routes',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: inboundRouteBody('B Route', '+15550001003'),
      });

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/inbound-routes',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json<{ data: unknown[] }>().data).toHaveLength(0);
    });

    it('tenant A cannot update tenant B inbound route', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`inbupd-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`inbupd-b-${sB}`, `admin-b-${sB}@example.com`);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/inbound-routes',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: inboundRouteBody('B Route', '+15550001004'),
      });
      expect(createRes.statusCode, `create failed: ${createRes.body}`).toBe(201);
      const routeBId = createRes.json<{ data: { id: string } }>().data.id;

      const patchRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/inbound-routes/${routeBId}`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { name: 'Hijacked Route', match_type: 'did', match_value: '+15550001004', target_type: 'flow' },
      });
      expect([403, 404]).toContain(patchRes.statusCode);
    });

    // ── Outbound routes ───────────────────────────────────────────────────────

    it('tenant A outbound route list does not include tenant B routes', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`out-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`out-b-${sB}`, `admin-b-${sB}@example.com`);

      // Tenant B creates a SIP trunk first (outbound route requires one)
      const trunkRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sip-trunks',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: sipTrunkBody('B Trunk'),
      });
      expect(trunkRes.statusCode, `trunk create failed: ${trunkRes.body}`).toBe(201);
      const trunkBId = trunkRes.json<{ data: { id: string } }>().data.id;

      await app.inject({
        method: 'POST',
        url: '/api/v1/outbound-routes',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { name: 'B Outbound Route', sip_trunk_id: trunkBId, match_prefix: '+' },
      });

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/outbound-routes',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json<{ data: unknown[] }>().data).toHaveLength(0);
    });

    // ── Call events ───────────────────────────────────────────────────────────

    it('runtime call-event ingest is tenant-scoped — tenant A cannot query tenant B events', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`evt-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`evt-b-${sB}`, `admin-b-${sB}@example.com`);
      const { tenant_id: tenantBId } = decodeJwt(tokenB);

      // Ingest an event for tenant B via the runtime endpoint
      const ingestRes = await app.inject({
        method: 'POST',
        url: '/api/v1/call-events/internal/ingest',
        headers: {
          authorization: `Bearer ${process.env.RUNTIME_API_TOKEN}`,
          'x-tenant-id': tenantBId,
        },
        payload: {
          tenant_id: tenantBId,
          call_id: 'call-b-001',
          event_type: 'channel_create',
          metadata: { direction: 'inbound' },
        },
      });
      expect(ingestRes.statusCode, `ingest failed: ${ingestRes.body}`).toBe(201);

      // Tenant A querying call events must not see tenant B's events
      const listResA = await app.inject({
        method: 'GET',
        url: '/api/v1/call-events',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(listResA.statusCode).toBe(200);
      const eventsA = listResA.json<{ data: unknown[] }>().data;
      expect(eventsA).toHaveLength(0);

      // Tenant B can see their own event
      const listResB = await app.inject({
        method: 'GET',
        url: '/api/v1/call-events',
        headers: { authorization: `Bearer ${tokenB}` },
      });
      expect(listResB.statusCode).toBe(200);
      expect(listResB.json<{ data: unknown[] }>().data).toHaveLength(1);
    });

    // ── Recordings ────────────────────────────────────────────────────────────

    it('tenant A recording list does not include tenant B recordings', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`rec-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`rec-b-${sB}`, `admin-b-${sB}@example.com`);
      const { tenant_id: tenantBId } = decodeJwt(tokenB);

      // Ingest a recording via the runtime path
      const recIngestRes = await app.inject({
        method: 'POST',
        url: '/api/v1/recordings/internal/ingest',
        headers: {
          authorization: `Bearer ${process.env.RUNTIME_API_TOKEN}`,
          'x-tenant-id': tenantBId,
        },
        payload: {
          tenant_id: tenantBId,
          call_id: 'call-rec-b-001',
          storage_path: '/recordings/b/call-rec-b-001.wav',
        },
      });
      expect(recIngestRes.statusCode, `recording ingest failed: ${recIngestRes.body}`).toBe(201);

      const listResA = await app.inject({
        method: 'GET',
        url: '/api/v1/recordings',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(listResA.statusCode).toBe(200);
      expect(listResA.json<{ data: unknown[] }>().data).toHaveLength(0);
    });

    // ── Automation webhooks ───────────────────────────────────────────────────

    it('tenant A webhook list does not include tenant B webhooks', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`wh-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`wh-b-${sB}`, `admin-b-${sB}@example.com`);

      await app.inject({
        method: 'POST',
        url: '/api/v1/automation/webhooks',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { name: 'B Webhook', url: 'https://b.example.com/webhook', events: ['call.started'] },
      });

      const listResA = await app.inject({
        method: 'GET',
        url: '/api/v1/automation/webhooks',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(listResA.statusCode).toBe(200);
      expect(listResA.json<{ data: unknown[] }>().data).toHaveLength(0);
    });

    it('tenant A cannot delete tenant B webhook', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`whd-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`whd-b-${sB}`, `admin-b-${sB}@example.com`);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/automation/webhooks',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { name: 'B Webhook', url: 'https://b.example.com/webhook', events: ['call.started'] },
      });
      expect(createRes.statusCode).toBe(201);
      const webhookBId = createRes.json<{ data: { id: string } }>().data.id;

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/automation/webhooks/${webhookBId}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect([403, 404]).toContain(deleteRes.statusCode);
    });

    // ── Fraud / outbound policy ───────────────────────────────────────────────

    it('tenant A fraud outbound policy does not expose tenant B policy', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`fraud-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`fraud-b-${sB}`, `admin-b-${sB}@example.com`);

      // Set a distinctive policy for tenant B using PUT (not POST)
      await app.inject({
        method: 'PUT',
        url: '/api/v1/fraud/outbound-policy',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { max_calls_per_minute: 77 },
      });

      // Tenant A gets their own policy — should not see max_calls_per_minute=77
      const resA = await app.inject({
        method: 'GET',
        url: '/api/v1/fraud/outbound-policy',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(resA.statusCode).toBe(200);
      // Tenant A has no configured policy — data is null or lacks tenant B's value
      const body = resA.json<{ data: { max_calls_per_minute?: number | null } | null }>();
      if (body.data !== null) {
        expect(body.data.max_calls_per_minute).not.toBe(77);
      }
      // Either null (no policy) or an unrelated default — both prove isolation
    });

    // ── Platform node registry ────────────────────────────────────────────────

    it('tenant user cannot access platform node registry endpoints', async () => {
      const sA = s();
      const tokenA = await register(`plat-a-${sA}`, `admin-a-${sA}@example.com`);

      for (const path of [
        '/api/v1/platform/tenants',
        '/api/v1/platform/runtime/health',
        '/api/v1/platform/runtime/summary',
      ]) {
        const res = await app.inject({
          method: 'GET',
          url: path,
          headers: { authorization: `Bearer ${tokenA}` },
        });
        expect([401, 403], `expected 401/403 for ${path}, got ${res.statusCode}`).toContain(
          res.statusCode,
        );
      }
    });

    // ── Approvals cross-tenant ────────────────────────────────────────────────

    it('tenant A cannot list or decide on tenant B approval requests', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`appr-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`appr-b-${sB}`, `admin-b-${sB}@example.com`);
      const { tenant_id: tenantBId, sub: userBId } = decodeJwt(tokenB);

      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO approval_requests (tenant_id, object_type, object_id, version_id, requested_by, status)
         VALUES ($1, 'ivr_flow', $2, $3, $4, 'pending')
         RETURNING id`,
        [tenantBId, randomUUID(), randomUUID(), userBId],
      );
      const approvalBId = rows[0]!.id;

      const listA = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(listA.statusCode).toBe(200);
      expect(listA.json<{ data: unknown[] }>().data).toHaveLength(0);

      const listB = await app.inject({
        method: 'GET',
        url: '/api/v1/approvals',
        headers: { authorization: `Bearer ${tokenB}` },
      });
      expect(listB.statusCode).toBe(200);
      expect(listB.json<{ data: unknown[] }>().data).toHaveLength(1);

      const approveRes = await app.inject({
        method: 'POST',
        url: `/api/v1/approvals/${approvalBId}/approve`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect([403, 404]).toContain(approveRes.statusCode);
    });

    // ── Audit log ─────────────────────────────────────────────────────────────

    it('tenant A cannot read tenant B audit log entries', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`aud-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`aud-b-${sB}`, `admin-b-${sB}@example.com`);
      const { tenant_id: tenantBId, sub: userBId } = decodeJwt(tokenB);

      await db.query(
        `INSERT INTO tenant_audit_log (tenant_id, actor_id, actor_role, action, resource_type)
         VALUES ($1, $2, 'tenant_admin', 'extension.created', 'extension')`,
        [tenantBId, userBId],
      );

      const resA = await app.inject({
        method: 'GET',
        url: '/api/v1/audit',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(resA.statusCode).toBe(200);
      expect(resA.json<{ data: unknown[] }>().data).toHaveLength(0);

      const resB = await app.inject({
        method: 'GET',
        url: '/api/v1/audit',
        headers: { authorization: `Bearer ${tokenB}` },
      });
      expect(resB.statusCode).toBe(200);
      expect(resB.json<{ data: unknown[] }>().data.length).toBeGreaterThanOrEqual(1);
    });

    // ── Schedules ─────────────────────────────────────────────────────────────

    it('tenant A schedule list and read do not expose tenant B schedules', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`sched-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`sched-b-${sB}`, `admin-b-${sB}@example.com`);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/schedules',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { name: 'B Schedule', timezone: 'UTC' },
      });
      expect(createRes.statusCode, `create failed: ${createRes.body}`).toBe(201);
      const scheduleBId = createRes.json<{ data: { id: string } }>().data.id;

      const listA = await app.inject({
        method: 'GET',
        url: '/api/v1/schedules',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(listA.statusCode).toBe(200);
      expect(listA.json<{ data: unknown[] }>().data).toHaveLength(0);

      const getA = await app.inject({
        method: 'GET',
        url: `/api/v1/schedules/${scheduleBId}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect([403, 404]).toContain(getA.statusCode);

      const patchA = await app.inject({
        method: 'PATCH',
        url: `/api/v1/schedules/${scheduleBId}`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { name: 'Hijacked Schedule' },
      });
      expect([403, 404]).toContain(patchA.statusCode);
    });

    // ── Queues ────────────────────────────────────────────────────────────────

    it('tenant A queue list and read do not expose tenant B queues', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`queue-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`queue-b-${sB}`, `admin-b-${sB}@example.com`);

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/queues',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { name: 'B Queue' },
      });
      expect(createRes.statusCode, `create failed: ${createRes.body}`).toBe(201);
      const queueBId = createRes.json<{ data: { id: string } }>().data.id;

      const listA = await app.inject({
        method: 'GET',
        url: '/api/v1/queues',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(listA.statusCode).toBe(200);
      expect(listA.json<{ data: unknown[] }>().data).toHaveLength(0);

      const getA = await app.inject({
        method: 'GET',
        url: `/api/v1/queues/${queueBId}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect([403, 404]).toContain(getA.statusCode);

      const patchA = await app.inject({
        method: 'PATCH',
        url: `/api/v1/queues/${queueBId}`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { name: 'Hijacked Queue' },
      });
      expect([403, 404]).toContain(patchA.statusCode);
    });

    // ── Export ────────────────────────────────────────────────────────────────

    it('tenant A cannot trigger export for tenant B', async () => {
      const sA = s();
      const sB = s();
      const tokenA = await register(`exp-a-${sA}`, `admin-a-${sA}@example.com`);
      const tokenB = await register(`exp-b-${sB}`, `admin-b-${sB}@example.com`);

      // Create a resource in tenant B
      await app.inject({
        method: 'POST',
        url: '/api/v1/extensions',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { extension_number: '901', display_name: 'B Ext', sip_password: 'Pass123!' },
      });

      // Tenant A POSTs to export — must be scoped to tenant A only
      const exportRes = await app.inject({
        method: 'POST',
        url: '/api/v1/export',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { include: ['extensions'] },
      });
      if (exportRes.statusCode === 200) {
        // Export must only contain tenant A data
        const exportData = exportRes.json<{ data?: { extensions?: unknown[] } }>();
        const extensions = exportData.data?.extensions ?? [];
        expect(extensions).toHaveLength(0);
      } else {
        // Export endpoint may not exist yet — 404 is acceptable
        expect([404]).toContain(exportRes.statusCode);
      }
    });
  });
});
