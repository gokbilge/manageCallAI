import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('IVR Flows API integration', () => {
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

    await db.query('SELECT pg_advisory_lock(72070)');
    try {
      await db.query('TRUNCATE TABLE tenants CASCADE');
    } finally {
      await db.query('SELECT pg_advisory_unlock(72070)');
    }
  });

  afterAll(async () => {
    await app.close();
    await db.end();
  });

  function testSuffix(): string {
    return `ivr-flow-${randomUUID().slice(0, 8)}`;
  }

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

  function decodeTokenClaims(token: string): { sub: string; tenant_id: string; email: string; role?: string } {
    const [, payload] = token.split('.');
    if (!payload) throw new Error('Invalid token');
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub: string;
      tenant_id: string;
      email: string;
      role?: string;
    };
  }

  const validDefinition = {
    entry_node_id: 'start',
    nodes: [
      { id: 'start', type: 'start', next_node_id: 'menu' },
      { id: 'menu', type: 'play_prompt', next_node_id: 'end' },
      { id: 'end', type: 'hangup' },
    ],
  };

  const invalidDefinition = { greeting: 'hello' };

  const simulationDefinition = {
    entry_node_id: 'start',
    nodes: [
      { id: 'start', type: 'start', next_node_id: 'welcome' },
      {
        id: 'welcome',
        type: 'play_collect',
        next_node_id: 'route_digit',
        timeout_node_id: 'end',
        invalid_node_id: 'end',
      },
      {
        id: 'route_digit',
        type: 'switch',
        cases: { '1': 'sales' },
        default_node_id: 'end',
      },
      { id: 'sales', type: 'transfer_extension', extension_number: '200' },
      { id: 'end', type: 'hangup' },
    ],
  };

  const callerNumberSimulationDefinition = {
    entry_node_id: 'start',
    nodes: [
      { id: 'start', type: 'start', next_node_id: 'route_caller' },
      {
        id: 'route_caller',
        type: 'switch',
        input: '{{caller_number}}',
        cases: { '+905551112233': 'vip' },
        default_node_id: 'end',
      },
      { id: 'vip', type: 'transfer_extension', extension_number: '900' },
      { id: 'end', type: 'hangup' },
    ],
  };

  const hourSimulationDefinition = {
    entry_node_id: 'start',
    nodes: [
      { id: 'start', type: 'start', next_node_id: 'hours' },
      {
        id: 'hours',
        type: 'switch',
        input: '{{now.hour}}',
        cases: { '10': 'open_extension' },
        default_node_id: 'after_hours',
      },
      { id: 'open_extension', type: 'transfer_extension', extension_number: '201' },
      { id: 'after_hours', type: 'hangup' },
    ],
  };

  const multiCollectSimulationDefinition = {
    entry_node_id: 'start',
    nodes: [
      { id: 'start', type: 'start', next_node_id: 'language_menu' },
      {
        id: 'language_menu',
        type: 'play_collect',
        next_node_id: 'language_switch',
        timeout_node_id: 'hangup',
        invalid_node_id: 'hangup',
      },
      {
        id: 'language_switch',
        type: 'switch',
        input: '{{last_digits}}',
        cases: { '9': 'department_menu' },
        default_node_id: 'hangup',
      },
      {
        id: 'department_menu',
        type: 'play_collect',
        next_node_id: 'department_switch',
        timeout_node_id: 'hangup',
        invalid_node_id: 'hangup',
      },
      {
        id: 'department_switch',
        type: 'switch',
        input: '{{last_digits}}',
        cases: { '2': 'support' },
        default_node_id: 'hangup',
      },
      { id: 'support', type: 'transfer_extension', extension_number: '202' },
      { id: 'hangup', type: 'hangup' },
    ],
  };

  it('GET /ivr-flows returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/ivr-flows' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /ivr-flows creates flow with draft version 1', async () => {
    const token = await register(testSuffix());
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Main Menu', description: 'Primary IVR', graph_json: validDefinition },
    });
    expect(res.statusCode).toBe(201);
    const { data } = res.json<{ data: Record<string, unknown> }>();
    expect(data.name).toBe('Main Menu');
    expect(data.status).toBe('draft');
    expect(data.draft_version_id).toBeTruthy();
    expect(data.active_version_id).toBeNull();
    const versions = data.versions as Array<Record<string, unknown>>;
    expect(versions).toHaveLength(1);
    expect(versions[0]?.version_number).toBe(1);
    expect(versions[0]?.state).toBe('draft');
    expect(versions[0]?.graph_json).toBeTruthy();
  });

  it('GET /ivr-flows/:id/versions lists versions for the tenant flow', async () => {
    const token = await register(testSuffix());
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Main Menu', graph_json: validDefinition },
    });
    const flow = createRes.json<{ data: { id: string } }>().data;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/ivr-flows/${flow.id}/versions`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: Array<{ version_number: number }> }>();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.version_number).toBe(1);
  });

  it('POST /ivr-flows/:id/versions/:vid/validate returns 422 for invalid definition', async () => {
    const token = await register(testSuffix());
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Bad Flow', definition: invalidDefinition },
    });
    const flow = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
    const versionId = flow.versions[0]!.id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/versions/${versionId}/validate`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json<{ data: { outcome: { status: string; errors: unknown[] } } }>();
    expect(body.data.outcome.status).toBe('failed');
    expect(body.data.outcome.errors.length).toBeGreaterThan(0);
  });

  it('POST /ivr-flows/:id/validate validates the current draft version', async () => {
    const token = await register(testSuffix());
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Draft Validate Flow', graph_json: validDefinition },
    });
    const flow = createRes.json<{ data: { id: string } }>().data;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/validate`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { outcome: { status: string } } }>();
    expect(body.data.outcome.status).toBe('passed');
  });

  it('POST /ivr-flows/:id/simulate simulates the current draft version', async () => {
    const token = await register(testSuffix());
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Simulation Flow', graph_json: simulationDefinition },
    });
    const flow = createRes.json<{ data: { id: string } }>().data;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/simulate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { digits: ['1'] },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      data: {
        outcome: {
          status: string;
          path: string[];
          final_action: { type: string; extension_number?: string };
        };
      };
    }>();
    expect(body.data.outcome.status).toBe('passed');
    expect(body.data.outcome.path).toEqual(['start', 'welcome', 'route_digit', 'sales']);
    expect(body.data.outcome.final_action.type).toBe('transfer_extension');
    expect(body.data.outcome.final_action.extension_number).toBe('200');
  });

  it('POST /ivr-flows/:id/versions/:vid/simulate returns 422 for unsupported runtime path', async () => {
    const token = await register(testSuffix());
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Broken Simulation Flow',
        graph_json: {
          entry_node_id: 'start',
          nodes: [
            { id: 'start', type: 'start', next_node_id: 'mystery' },
            { id: 'mystery', type: 'unsupported_future_node' },
          ],
        },
      },
    });
    const flow = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/versions/${flow.versions[0]!.id}/simulate`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(422);
    const body = res.json<{ data: { outcome: { status: string; errors: Array<{ message: string }> } } }>();
    expect(body.data.outcome.status).toBe('failed');
    expect(body.data.outcome.errors[0]?.message).toContain('Unsupported node type');
  });

  it('simulation resolves switch input from caller_number', async () => {
    const token = await register(testSuffix());
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Caller Flow', graph_json: callerNumberSimulationDefinition },
    });
    const flow = createRes.json<{ data: { id: string } }>().data;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/simulate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { caller_number: '+905551112233' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { outcome: { path: string[]; final_action: { extension_number?: string } } } }>();
    expect(body.data.outcome.path).toEqual(['start', 'route_caller', 'vip']);
    expect(body.data.outcome.final_action.extension_number).toBe('900');
  });

  it('simulation resolves switch input from now.hour', async () => {
    const token = await register(testSuffix());
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Business Hours Flow', graph_json: hourSimulationDefinition },
    });
    const flow = createRes.json<{ data: { id: string } }>().data;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/simulate`,
      headers: { authorization: `Bearer ${token}` },
      payload: { now: '2026-05-27T10:00:00+03:00' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { outcome: { path: string[]; final_action: { extension_number?: string } } } }>();
    expect(body.data.outcome.path).toEqual(['start', 'hours', 'open_extension']);
    expect(body.data.outcome.final_action.extension_number).toBe('201');
  });

  it('simulation supports node-specific collected digits across multiple play_collect nodes', async () => {
    const token = await register(testSuffix());
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Multi Collect Flow', graph_json: multiCollectSimulationDefinition },
    });
    const flow = createRes.json<{ data: { id: string } }>().data;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/simulate`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        collected_digits: {
          language_menu: '9',
          department_menu: '2',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { outcome: { path: string[]; final_action: { extension_number?: string } } } }>();
    expect(body.data.outcome.path).toEqual([
      'start',
      'language_menu',
      'language_switch',
      'department_menu',
      'department_switch',
      'support',
    ]);
    expect(body.data.outcome.final_action.extension_number).toBe('202');
  });

  it('full lifecycle: create, validate, publish, rollback', async () => {
    const token = await register(testSuffix());

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Lifecycle Flow', definition: validDefinition },
    });
    expect(createRes.statusCode).toBe(201);
    const flow = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
    const v1Id = flow.versions[0]!.id;

    const validateRes = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/versions/${v1Id}/validate`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(validateRes.statusCode).toBe(200);
    const validateBody = validateRes.json<{ data: { outcome: { status: string }; version: { state: string } } }>();
    expect(validateBody.data.outcome.status).toBe('passed');
    expect(validateBody.data.version.state).toBe('validated');

    const publishRes = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/versions/${v1Id}/publish`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(publishRes.statusCode).toBe(200);
    const published = publishRes.json<{ data: { status: string; flow: { active_version_id: string } } }>().data;
    expect(published.status).toBe('published');
    expect(published.flow.active_version_id).toBe(v1Id);

    const v2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/versions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { graph_json: { ...validDefinition, entry_node_id: 'menu' } },
    });
    expect(v2Res.statusCode).toBe(201);
    const v2 = v2Res.json<{ data: { id: string; version_number: number; state: string } }>().data;
    expect(v2.version_number).toBe(2);
    expect(v2.state).toBe('draft');

    await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/versions/${v2.id}/validate`,
      headers: { authorization: `Bearer ${token}` },
    });

    const publish2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/versions/${v2.id}/publish`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(publish2Res.statusCode).toBe(200);
    const published2 = publish2Res.json<{ data: { flow: { active_version_id: string } } }>().data;
    expect(published2.flow.active_version_id).toBe(v2.id);

    const rollbackRes = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/rollback`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(rollbackRes.statusCode).toBe(200);
    const rolledBack = rollbackRes.json<{ data: { status: string; flow: { active_version_id: string } } }>().data;
    expect(rolledBack.status).toBe('published');
    expect(rolledBack.flow.active_version_id).toBe(v1Id);
  });

  it('publish returns 409 when version is not validated', async () => {
    const token = await register(testSuffix());
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Flow', definition: validDefinition },
    });
    const flow = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
    const versionId = flow.versions[0]!.id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/versions/${versionId}/publish`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('rollback returns 409 when no superseded version exists', async () => {
    const token = await register(testSuffix());
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Flow', definition: validDefinition },
    });
    const flow = createRes.json<{ data: { id: string } }>().data;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/rollback`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('publish returns 202 pending approval when tenant policy requires approval', async () => {
    const suffix = testSuffix();
    const token = await register(suffix);
    const claims = decodeTokenClaims(token);

    await db.query(
      `INSERT INTO policies (tenant_id, name, policy_type, rules, status)
       VALUES ($1, 'IVR publish approvals', 'ivr_publish_control', $2, 'active')`,
      [claims.tenant_id, JSON.stringify({ require_approval: true })],
    );

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Approval Flow', definition: validDefinition },
    });
    const flow = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
    const versionId = flow.versions[0]!.id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/versions/${versionId}/validate`,
      headers: { authorization: `Bearer ${token}` },
    });

    const publishRes = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/versions/${versionId}/publish`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(publishRes.statusCode).toBe(202);
    const body = publishRes.json<{
      data: {
        status: string;
        flow: { active_version_id: string | null };
        approval_request_id?: string;
      };
    }>();
    expect(body.data.status).toBe('pending_approval');
    expect(body.data.flow.active_version_id).toBeNull();
    expect(body.data.approval_request_id).toBeTruthy();
  });

  it('GET /ivr-flows/:id returns 404 for non-existent flow', async () => {
    const token = await register(testSuffix());
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/ivr-flows/${randomUUID()}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('tenant isolation prevents reading another tenant flow', async () => {
    const token1 = await register(testSuffix());
    const token2 = await register(testSuffix());

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token1}` },
      payload: { name: 'Private Flow', definition: validDefinition },
    });
    const flow = createRes.json<{ data: { id: string } }>().data;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/ivr-flows/${flow.id}`,
      headers: { authorization: `Bearer ${token2}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
