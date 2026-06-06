import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('IVR AI generation and patch endpoints', () => {
  let app: FastifyInstance;
  let db: Pool;
  const runtimeToken = 'test-runtime-token';

  beforeAll(async () => {
    process.env.RUNTIME_API_TOKEN ??= runtimeToken;
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
        display_name: 'Test',
        password: 'Secret123!',
      },
    });
    return res.json<{ token: string }>().token;
  }

  // ── IVR Generation (#253) ─────────────────────────────────────────────────

  describe('POST /api/v1/ivr-generation', () => {
    it('creates a generation request and a draft IVR flow', async () => {
      const token = await register(randomUUID().slice(0, 8));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-generation',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          flow_name: 'AI Generated Menu',
          intent: 'A main menu with sales, support, and billing options, press 1 for sales',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ data: { generation_request: Record<string, unknown>; flow: Record<string, unknown> } }>();
      expect(body.data.generation_request.status).toBe('queued');
      expect(body.data.generation_request.intent).toContain('main menu');
      expect(body.data.flow).toBeDefined();
      expect(body.data.flow.name).toBe('AI Generated Menu');
    });

    it('lists generation requests', async () => {
      const token = await register(randomUUID().slice(0, 8));
      await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-generation',
        headers: { authorization: `Bearer ${token}` },
        payload: { flow_name: 'Test Flow', intent: 'Simple IVR with hangup' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/ivr-generation',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: unknown[] }>();
      expect(body.data.length).toBeGreaterThan(0);
    });

    it('gets a specific generation request by id', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-generation',
        headers: { authorization: `Bearer ${token}` },
        payload: { flow_name: 'Single Fetch', intent: 'Greeting then hangup' },
      });
      const genId = createRes.json<{ data: { generation_request: { id: string } } }>().data.generation_request.id;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-generation/${genId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { id: string; status: string } }>();
      expect(body.data.id).toBe(genId);
      expect(body.data.status).toBe('queued');
    });

    it('returns 404 for unknown generation request', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-generation/${randomUUID()}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Worker: claim + complete IVR generation', () => {
    it('claims and completes a generation request, graph stored', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-generation',
        headers: { authorization: `Bearer ${token}` },
        payload: { flow_name: 'Worker Test', intent: 'Simple menu' },
      });
      const genId = createRes.json<{ data: { generation_request: { id: string } } }>().data.generation_request.id;

      const claimRes = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-generation/internal/${genId}/claim`,
        headers: { authorization: `Bearer ${runtimeToken}` },
        payload: { processor_id: 'worker-1' },
      });
      expect(claimRes.statusCode).toBe(200);
      expect(claimRes.json<{ data: { status: string } }>().data.status).toBe('processing');

      const generatedGraph = {
        entry_node_id: 'start',
        nodes: [
          { id: 'start', type: 'start', next_node_id: 'menu' },
          { id: 'menu', type: 'play_collect', next_node_id: 'hangup', prompt_id: null, max_digits: 1 },
          { id: 'hangup', type: 'hangup' },
        ],
      };

      const completeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-generation/internal/${genId}/result`,
        headers: { authorization: `Bearer ${runtimeToken}` },
        payload: { status: 'completed', generated_graph: generatedGraph },
      });
      expect(completeRes.statusCode).toBe(200);
      const completed = completeRes.json<{ data: { status: string; generated_graph: Record<string, unknown> } }>().data;
      expect(completed.status).toBe('completed');
      expect(completed.generated_graph).toBeDefined();
    });

    it('marks a generation request failed', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ivr-generation',
        headers: { authorization: `Bearer ${token}` },
        payload: { flow_name: 'Fail Test', intent: 'Will fail' },
      });
      const genId = createRes.json<{ data: { generation_request: { id: string } } }>().data.generation_request.id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-generation/internal/${genId}/claim`,
        headers: { authorization: `Bearer ${runtimeToken}` },
        payload: {},
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-generation/internal/${genId}/result`,
        headers: { authorization: `Bearer ${runtimeToken}` },
        payload: { status: 'failed', error_message: 'Provider timeout' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: { status: string } }>().data.status).toBe('failed');
    });
  });

  // ── IVR AI patches (#254) ─────────────────────────────────────────────────

  async function createFlowAndDraft(token: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Patchable Flow',
        graph_json: {
          entry_node_id: 'start',
          nodes: [
            { id: 'start', type: 'start', next_node_id: 'end' },
            { id: 'end', type: 'hangup' },
          ],
        },
      },
    });
    return res.json<{ data: { id: string; draft_version_id: string } }>().data;
  }

  describe('POST /api/v1/ivr-flows/:id/ai-patches', () => {
    it('creates a patch request for an IVR draft', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const flow = await createFlowAndDraft(token);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/ai-patches`,
        headers: { authorization: `Bearer ${token}` },
        payload: { intent: 'Add a VIP caller branch for +1800 prefixes' },
      });

      expect(res.statusCode).toBe(201);
      const patch = res.json<{ data: { id: string; status: string; target_id: string } }>().data;
      expect(patch.status).toBe('queued');
      expect(patch.target_id).toBe(flow.id);
    });

    it('lists patch requests for a flow', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const flow = await createFlowAndDraft(token);
      await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/ai-patches`,
        headers: { authorization: `Bearer ${token}` },
        payload: { intent: 'Simplify the menu' },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-flows/${flow.id}/ai-patches`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: unknown[] }>();
      expect(body.data.length).toBeGreaterThan(0);
    });

    it('gets a specific patch by id', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const flow = await createFlowAndDraft(token);
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/ai-patches`,
        headers: { authorization: `Bearer ${token}` },
        payload: { intent: 'Add voicemail option' },
      });
      const patchId = createRes.json<{ data: { id: string } }>().data.id;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/ivr-flows/${flow.id}/ai-patches/${patchId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: { id: string } }>().data.id).toBe(patchId);
    });

    it('rejects accept on a queued (not completed) patch', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const flow = await createFlowAndDraft(token);
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/ai-patches`,
        headers: { authorization: `Bearer ${token}` },
        payload: { intent: 'Add a branch' },
      });
      const patchId = createRes.json<{ data: { id: string } }>().data.id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/ai-patches/${patchId}/accept`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(412);
    });

    it('rejects reject on a queued (not completed) patch', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const flow = await createFlowAndDraft(token);
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/ai-patches`,
        headers: { authorization: `Bearer ${token}` },
        payload: { intent: 'Add a branch' },
      });
      const patchId = createRes.json<{ data: { id: string } }>().data.id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/ai-patches/${patchId}/reject`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(412);
    });
  });

  describe('Worker + accept/reject IVR AI patch full lifecycle', () => {
    it('claim → complete → accept applies diff and creates new version', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const flow = await createFlowAndDraft(token);

      const createRes = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/ai-patches`,
        headers: { authorization: `Bearer ${token}` },
        payload: { intent: 'Add a support branch' },
      });
      const patchId = createRes.json<{ data: { id: string } }>().data.id;

      // Claim
      const claimRes = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-ai-patches/internal/${patchId}/claim`,
        headers: { authorization: `Bearer ${runtimeToken}` },
        payload: { processor_id: 'worker-1' },
      });
      expect(claimRes.statusCode).toBe(200);
      expect(claimRes.json<{ data: { status: string } }>().data.status).toBe('processing');

      // Complete with a diff
      const diff = {
        nodes: {
          add: [{ id: 'support', type: 'transfer_extension', extension_id: null }],
          remove: [],
          modify: [],
        },
        edges: {
          add: [{ id: 'e-support', from: 'start', to: 'support' }],
          remove: [],
          modify: [],
        },
      };
      const completeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-ai-patches/internal/${patchId}/result`,
        headers: { authorization: `Bearer ${runtimeToken}` },
        payload: {
          status: 'completed',
          diff_json: diff,
          risk_level: 'low',
          risk_summary: 'Only adds a new node, no existing nodes modified',
          blast_radius_hint: 'New branch only',
        },
      });
      expect(completeRes.statusCode).toBe(200);
      const completed = completeRes.json<{ data: { status: string; risk_level: string } }>().data;
      expect(completed.status).toBe('completed');
      expect(completed.risk_level).toBe('low');

      // Accept
      const acceptRes = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/ai-patches/${patchId}/accept`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(acceptRes.statusCode).toBe(200);
      const accepted = acceptRes.json<{ data: { patch_request: { status: string }; new_version: { id: string } } }>();
      expect(accepted.data.patch_request.status).toBe('accepted');
      expect(accepted.data.new_version.id).toBeDefined();
    });

    it('claim → complete → reject does not change the flow', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const flow = await createFlowAndDraft(token);

      const createRes = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/ai-patches`,
        headers: { authorization: `Bearer ${token}` },
        payload: { intent: 'Risky change' },
      });
      const patchId = createRes.json<{ data: { id: string } }>().data.id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-ai-patches/internal/${patchId}/claim`,
        headers: { authorization: `Bearer ${runtimeToken}` },
        payload: {},
      });
      await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-ai-patches/internal/${patchId}/result`,
        headers: { authorization: `Bearer ${runtimeToken}` },
        payload: {
          status: 'completed',
          diff_json: { nodes: { add: [], remove: ['end'], modify: [] } },
          risk_level: 'high',
          risk_summary: 'Removes terminal node',
        },
      });

      const rejectRes = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/ai-patches/${patchId}/reject`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(rejectRes.statusCode).toBe(200);
      expect(rejectRes.json<{ data: { status: string } }>().data.status).toBe('rejected');
    });

    it('returns 412 when accepting a patch with no diff_json', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const flow = await createFlowAndDraft(token);
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/ai-patches`,
        headers: { authorization: `Bearer ${token}` },
        payload: { intent: 'Empty diff' },
      });
      const patchId = createRes.json<{ data: { id: string } }>().data.id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-ai-patches/internal/${patchId}/claim`,
        headers: { authorization: `Bearer ${runtimeToken}` },
        payload: {},
      });
      await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-ai-patches/internal/${patchId}/result`,
        headers: { authorization: `Bearer ${runtimeToken}` },
        payload: { status: 'completed', diff_json: null },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-flows/${flow.id}/ai-patches/${patchId}/accept`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(412);
    });
  });

  // ── Inbound route AI patches (#254) ──────────────────────────────────────

  describe('POST /api/v1/inbound-routes/:id/ai-patches', () => {
    async function createRoute(token: string) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/inbound-routes',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'Test Route',
          match_type: 'pattern',
          match_value: '^\\+1555',
          target_type: 'flow',
        },
      });
      return res.json<{ data: { id: string } }>().data;
    }

    it('creates a patch request for an inbound route draft', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const route = await createRoute(token);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/inbound-routes/${route.id}/ai-patches`,
        headers: { authorization: `Bearer ${token}` },
        payload: { intent: 'Change target to queue for business hours' },
      });
      expect(res.statusCode).toBe(201);
      const patch = res.json<{ data: { status: string; target_type: string } }>().data;
      expect(patch.status).toBe('queued');
      expect(patch.target_type).toBe('inbound_route');
    });

    it('lists patches for a route', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const route = await createRoute(token);
      await app.inject({
        method: 'POST',
        url: `/api/v1/inbound-routes/${route.id}/ai-patches`,
        headers: { authorization: `Bearer ${token}` },
        payload: { intent: 'Adjust routing' },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/inbound-routes/${route.id}/ai-patches`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: unknown[] }>();
      expect(body.data.length).toBeGreaterThan(0);
    });

    it('gets a specific route patch by id', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const route = await createRoute(token);
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/v1/inbound-routes/${route.id}/ai-patches`,
        headers: { authorization: `Bearer ${token}` },
        payload: { intent: 'Route to extension' },
      });
      const patchId = createRes.json<{ data: { id: string } }>().data.id;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/inbound-routes/${route.id}/ai-patches/${patchId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: { id: string } }>().data.id).toBe(patchId);
    });

    it('accept and reject lifecycle for route patches', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const route = await createRoute(token);
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/v1/inbound-routes/${route.id}/ai-patches`,
        headers: { authorization: `Bearer ${token}` },
        payload: { intent: 'Change route' },
      });
      const patchId = createRes.json<{ data: { id: string } }>().data.id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-ai-patches/internal/${patchId}/claim`,
        headers: { authorization: `Bearer ${runtimeToken}` },
        payload: {},
      });
      await app.inject({
        method: 'POST',
        url: `/api/v1/ivr-ai-patches/internal/${patchId}/result`,
        headers: { authorization: `Bearer ${runtimeToken}` },
        payload: {
          status: 'completed',
          diff_json: { fields: { target_type: 'extension' } },
          risk_level: 'medium',
        },
      });

      const acceptRes = await app.inject({
        method: 'POST',
        url: `/api/v1/inbound-routes/${route.id}/ai-patches/${patchId}/accept`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(acceptRes.statusCode).toBe(200);
      expect(acceptRes.json<{ data: { status: string } }>().data.status).toBe('accepted');
    });
  });
});
