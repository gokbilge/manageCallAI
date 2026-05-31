import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('IVR flow boundary and lifecycle endpoints', () => {
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

  async function register(suf: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: `Tenant ${suf}`,
        tenant_slug: `tenant-${suf}`,
        email: `user-${suf}@example.com`,
        display_name: 'Test User',
        password: 'Secret123!',
      },
    });
    return res.json<{ token: string }>().token;
  }

  const validDef = {
    entry_node_id: 'start',
    nodes: [
      { id: 'start', type: 'start', next_node_id: 'menu' },
      { id: 'menu', type: 'play_prompt', next_node_id: 'end' },
      { id: 'end', type: 'hangup' },
    ],
  };

  const minimalDef = {
    entry_node_id: 'start',
    nodes: [
      { id: 'start', type: 'start', next_node_id: 'end' },
      { id: 'end', type: 'hangup' },
    ],
  };

  // ── GET /ivr-flows/:id/versions/:vid ──────────────────────────────────────

  describe('GET /ivr-flows/:id/versions/:vid', () => {
    it('returns the specific version including graph_json', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Versioned Flow', graph_json: validDef },
      });
      const flow = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
      const vid = flow.versions[0]!.id;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-flows/${flow.id}/versions/${vid}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { id: string; version_number: number; state: string; graph_json: unknown } }>();
      expect(body.data.id).toBe(vid);
      expect(body.data.version_number).toBe(1);
      expect(body.data.state).toBe('draft');
      expect(body.data.graph_json).toBeTruthy();
    });

    it('returns 404 for a version belonging to another tenant flow', async () => {
      const token1 = await register(randomUUID().slice(0, 8));
      const token2 = await register(randomUUID().slice(0, 8));

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${token1}` },
        payload: { name: 'T1 Flow', graph_json: validDef },
      });
      const flow = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-flows/${flow.id}/versions/${flow.versions[0]!.id}`,
        headers: { authorization: `Bearer ${token2}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── PATCH /ivr-flows/:id/versions/:vid ───────────────────────────────────

  describe('PATCH /ivr-flows/:id/versions/:vid', () => {
    it('updates the draft version graph_json', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Patchable Flow', graph_json: minimalDef },
      });
      const flow = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
      const vid = flow.versions[0]!.id;

      const updatedDef = {
        entry_node_id: 'start',
        nodes: [
          { id: 'start', type: 'start', next_node_id: 'greeting' },
          { id: 'greeting', type: 'play_prompt', next_node_id: 'end' },
          { id: 'end', type: 'hangup' },
        ],
      };

      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/ivr-flows/${flow.id}/versions/${vid}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { graph_json: updatedDef },
      });
      expect(patchRes.statusCode).toBe(200);
      const updated = patchRes.json<{
        data: { id: string; graph_json: { nodes: Array<{ id: string }> } };
      }>();
      expect(updated.data.id).toBe(vid);
      const nodeIds = updated.data.graph_json.nodes.map((n) => n.id);
      expect(nodeIds).toContain('greeting');
    });

    it('accepts definition alias as well as graph_json', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Alias Flow', graph_json: minimalDef },
      });
      const flow = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/ivr-flows/${flow.id}/versions/${flow.versions[0]!.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { definition: validDef },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // ── GET /ivr-flows/:id/diff ───────────────────────────────────────────────

  describe('GET /ivr-flows/:id/diff', () => {
    it('reports added nodes in draft when there is no active version', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Diff Flow', graph_json: validDef },
      });
      const flow = createRes.json<{ data: { id: string } }>().data;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-flows/${flow.id}/diff`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{
        data: {
          flow_id: string;
          active_version_id: null | string;
          summary: { added: number; removed: number; modified: number; unchanged: number };
          added: unknown[];
        };
      }>();
      expect(body.data.flow_id).toBe(flow.id);
      expect(body.data.active_version_id).toBeNull();
      // All draft nodes are "added" when there is no active version
      expect(body.data.summary.added).toBe(validDef.nodes.length);
      expect(body.data.added).toHaveLength(validDef.nodes.length);
    });

    it('diff shows removed nodes after publishing and trimming draft', async () => {
      const token = await register(randomUUID().slice(0, 8));

      // v1: three-node flow (start → menu → end)
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Diff Lifecycle', graph_json: validDef },
      });
      const flow = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
      const v1Id = flow.versions[0]!.id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/versions/${v1Id}/validate`,
        headers: { authorization: `Bearer ${token}` },
      });
      await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/versions/${v1Id}/publish`,
        headers: { authorization: `Bearer ${token}` },
      });

      // v2: minimal two-node flow (start → end), removes menu
      const v2Res = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/versions`,
        headers: { authorization: `Bearer ${token}` },
        payload: { graph_json: minimalDef },
      });
      expect(v2Res.statusCode).toBe(201);

      const diffRes = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-flows/${flow.id}/diff`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(diffRes.statusCode).toBe(200);
      const diff = diffRes.json<{
        data: {
          summary: { added: number; removed: number; modified: number; unchanged: number };
          removed: Array<{ id: string }>;
        };
      }>();
      expect(diff.data.summary.removed).toBe(1);
      expect(diff.data.removed[0]?.id).toBe('menu');
    });

    it('returns 404 when there is no draft version', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-flows/${randomUUID()}/diff`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── GET /ivr-flows/:id/history ───────────────────────────────────────────

  describe('GET /ivr-flows/:id/history', () => {
    it('returns empty history on a freshly created flow', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'History Flow', graph_json: validDef },
      });
      const flow = createRes.json<{ data: { id: string } }>().data;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-flows/${flow.id}/history`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { validations: unknown[]; simulations: unknown[] } }>();
      expect(Array.isArray(body.data.validations)).toBe(true);
      expect(Array.isArray(body.data.simulations)).toBe(true);
    });

    it('records validation and simulation results in history', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const simDef = {
        entry_node_id: 'start',
        nodes: [
          { id: 'start', type: 'start', next_node_id: 'menu' },
          {
            id: 'menu',
            type: 'play_collect',
            next_node_id: 'route',
            timeout_node_id: 'end',
            invalid_node_id: 'end',
          },
          {
            id: 'route',
            type: 'switch',
            cases: { '1': 'sales' },
            default_node_id: 'end',
          },
          { id: 'sales', type: 'transfer_extension', extension_number: '200' },
          { id: 'end', type: 'hangup' },
        ],
      };

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'History Tracked', graph_json: simDef },
      });
      const flow = createRes.json<{ data: { id: string } }>().data;

      await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/validate`,
        headers: { authorization: `Bearer ${token}` },
      });

      await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/simulate`,
        headers: { authorization: `Bearer ${token}` },
        payload: { digits: ['1'] },
      });

      const historyRes = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-flows/${flow.id}/history`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(historyRes.statusCode).toBe(200);
      const history = historyRes.json<{
        data: {
          validations: Array<{ status: string }>;
          simulations: Array<{ status: string }>;
        };
      }>();
      expect(history.data.validations.length).toBeGreaterThanOrEqual(1);
      expect(history.data.simulations.length).toBeGreaterThanOrEqual(1);
      expect(history.data.validations[0]?.status).toBe('passed');
      expect(history.data.simulations[0]?.status).toBe('passed');
    });

    it('tenant isolation: tenant B cannot access tenant A flow history', async () => {
      const token1 = await register(randomUUID().slice(0, 8));
      const token2 = await register(randomUUID().slice(0, 8));

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${token1}` },
        payload: { name: 'T1 History', graph_json: validDef },
      });
      const flow = createRes.json<{ data: { id: string } }>().data;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-flows/${flow.id}/history`,
        headers: { authorization: `Bearer ${token2}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── GET /ivr-flows/:id/simulation-coverage ───────────────────────────────

  describe('GET /ivr-flows/:id/simulation-coverage', () => {
    it('reports all nodes as untested on a fresh flow', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Coverage Flow', graph_json: validDef },
      });
      const flow = createRes.json<{ data: { id: string } }>().data;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-flows/${flow.id}/simulation-coverage`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{
        data: {
          coverage_pct: number;
          tested_count: number;
          total_count: number;
          nodes: Record<string, 'tested' | 'untested'>;
        };
      }>();
      expect(body.data.coverage_pct).toBe(0);
      expect(body.data.tested_count).toBe(0);
      expect(body.data.total_count).toBeGreaterThan(0);
      for (const status of Object.values(body.data.nodes)) {
        expect(status).toBe('untested');
      }
    });

    it('marks visited nodes as tested after a simulation', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const branchDef = {
        entry_node_id: 'start',
        nodes: [
          { id: 'start', type: 'start', next_node_id: 'menu' },
          {
            id: 'menu',
            type: 'play_collect',
            next_node_id: 'route',
            timeout_node_id: 'timeout',
            invalid_node_id: 'timeout',
          },
          {
            id: 'route',
            type: 'switch',
            cases: { '1': 'sales', '2': 'support' },
            default_node_id: 'timeout',
          },
          { id: 'sales', type: 'transfer_extension', extension_number: '200' },
          { id: 'support', type: 'transfer_extension', extension_number: '201' },
          { id: 'timeout', type: 'hangup' },
        ],
      };

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Branch Coverage', graph_json: branchDef },
      });
      const flow = createRes.json<{ data: { id: string } }>().data;

      await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/simulate`,
        headers: { authorization: `Bearer ${token}` },
        payload: { digits: ['1'] },
      });

      const coverageRes = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-flows/${flow.id}/simulation-coverage`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(coverageRes.statusCode).toBe(200);
      const coverage = coverageRes.json<{
        data: {
          coverage_pct: number;
          tested_count: number;
          nodes: Record<string, 'tested' | 'untested'>;
        };
      }>();
      expect(coverage.data.tested_count).toBeGreaterThan(0);
      expect(coverage.data.coverage_pct).toBeGreaterThan(0);
      expect(coverage.data.nodes['sales']).toBe('tested');
      expect(coverage.data.nodes['support']).toBe('untested');
    });

    it('reaches 100% coverage after simulating all branches', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const simDef = {
        entry_node_id: 'start',
        nodes: [
          { id: 'start', type: 'start', next_node_id: 'menu' },
          {
            id: 'menu',
            type: 'play_collect',
            next_node_id: 'route',
            timeout_node_id: 'end',
            invalid_node_id: 'end',
          },
          {
            id: 'route',
            type: 'switch',
            cases: { '1': 'dest' },
            default_node_id: 'end',
          },
          { id: 'dest', type: 'transfer_extension', extension_number: '300' },
          { id: 'end', type: 'hangup' },
        ],
      };

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Full Coverage', graph_json: simDef },
      });
      const flow = createRes.json<{ data: { id: string } }>().data;

      // Simulate the sales branch (digit 1)
      await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/simulate`,
        headers: { authorization: `Bearer ${token}` },
        payload: { digits: ['1'] },
      });
      // Simulate the timeout/invalid/default path
      await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/simulate`,
        headers: { authorization: `Bearer ${token}` },
        payload: { digits: ['9'] },
      });

      const coverageRes = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-flows/${flow.id}/simulation-coverage`,
        headers: { authorization: `Bearer ${token}` },
      });
      const coverage = coverageRes.json<{ data: { coverage_pct: number } }>();
      expect(coverage.data.coverage_pct).toBe(100);
    });

    it('returns 404 for a non-existent flow', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-flows/${randomUUID()}/simulation-coverage`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── POST /ivr-flows/:id/versions (new version after publish) ─────────────

  describe('POST /ivr-flows/:id/versions', () => {
    it('creates a new draft version with incremented version_number', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-flows',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Multi-Version Flow', graph_json: validDef },
      });
      const flow = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
      const v1Id = flow.versions[0]!.id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/versions/${v1Id}/validate`,
        headers: { authorization: `Bearer ${token}` },
      });
      await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/versions/${v1Id}/publish`,
        headers: { authorization: `Bearer ${token}` },
      });

      const v2Res = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/versions`,
        headers: { authorization: `Bearer ${token}` },
        payload: { graph_json: minimalDef },
      });
      expect(v2Res.statusCode).toBe(201);
      const v2 = v2Res.json<{ data: { id: string; version_number: number; state: string } }>().data;
      expect(v2.version_number).toBe(2);
      expect(v2.state).toBe('draft');
      expect(v2.id).not.toBe(v1Id);
    });
  });

  // ── Runtime boundary: diff and simulation-coverage are auth-gated ─────────

  describe('runtime boundary auth enforcement', () => {
    it('diff endpoint returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-flows/${randomUUID()}/diff`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('simulation-coverage endpoint returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-flows/${randomUUID()}/simulation-coverage`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('history endpoint returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-flows/${randomUUID()}/history`,
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
