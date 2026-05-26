import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Inbound Routes API integration', () => {
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

  async function createActiveFlow(token: string, name: string): Promise<string> {
    const validDef = { nodes: [{ id: 'start', type: 'hangup' }], entry_node_id: 'start' };
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token}` },
      payload: { name, definition: validDef },
    });
    const flow = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
    const vid = flow.versions[0]!.id;
    await app.inject({ method: 'POST', url: `/api/v1/ivr-flows/${flow.id}/versions/${vid}/validate`, headers: { authorization: `Bearer ${token}` } });
    await app.inject({ method: 'POST', url: `/api/v1/ivr-flows/${flow.id}/versions/${vid}/publish`, headers: { authorization: `Bearer ${token}` } });
    return flow.id;
  }

  it('GET /inbound-routes → 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/inbound-routes' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /inbound-routes → creates route with draft version', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/inbound-routes',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Main DID', match_type: 'did', match_value: '+15551234567', target_type: 'flow' },
    });
    expect(res.statusCode).toBe(201);
    const { data } = res.json<{ data: Record<string, unknown> }>();
    expect(data['name']).toBe('Main DID');
    expect(data['status']).toBe('draft');
    expect(data['match_type']).toBe('did');
    expect(data['target_type']).toBe('flow');
    const versions = data['versions'] as unknown[];
    expect(versions).toHaveLength(1);
    expect((versions[0] as Record<string, unknown>)['state']).toBe('draft');
  });

  it('validate → 422 when target flow is not active', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const fakeFlowId = randomUUID();

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/inbound-routes',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Route', match_type: 'did', match_value: '+15550000001', target_type: 'flow', target_id: fakeFlowId },
    });
    const route = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
    const vid = route.versions[0]!.id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/inbound-routes/${route.id}/versions/${vid}/validate`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json<{ data: { outcome: { status: string; errors: unknown[] } } }>();
    expect(body.data.outcome.status).toBe('failed');
  });

  it('full lifecycle: create → validate (with active flow target) → publish → rollback', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const flowId = await createActiveFlow(token, 'Support Flow');

    // Create route pointing at the active flow
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/inbound-routes',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Support DID', match_type: 'did', match_value: '+15559990001', target_type: 'flow', target_id: flowId },
    });
    expect(createRes.statusCode).toBe(201);
    const route = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
    const v1Id = route.versions[0]!.id;

    // Validate v1
    const validateRes = await app.inject({
      method: 'POST',
      url: `/api/v1/inbound-routes/${route.id}/versions/${v1Id}/validate`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(validateRes.statusCode).toBe(200);
    const validateBody = validateRes.json<{ data: { outcome: { status: string }; version: { state: string } } }>();
    expect(validateBody.data.outcome.status).toBe('passed');
    expect(validateBody.data.version.state).toBe('validated');

    // Publish v1
    const publishRes = await app.inject({
      method: 'POST',
      url: `/api/v1/inbound-routes/${route.id}/versions/${v1Id}/publish`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(publishRes.statusCode).toBe(200);
    const published = publishRes.json<{ data: { status: string; active_version_id: string } }>().data;
    expect(published.status).toBe('active');
    expect(published.active_version_id).toBe(v1Id);

    // Create and publish v2
    const v2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/inbound-routes/${route.id}/versions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { definition: { match_type: 'did', match_value: '+15559990001', target_type: 'flow', target_id: flowId } },
    });
    const v2 = v2Res.json<{ data: { id: string } }>().data;
    await app.inject({ method: 'POST', url: `/api/v1/inbound-routes/${route.id}/versions/${v2.id}/validate`, headers: { authorization: `Bearer ${token}` } });
    await app.inject({ method: 'POST', url: `/api/v1/inbound-routes/${route.id}/versions/${v2.id}/publish`, headers: { authorization: `Bearer ${token}` } });

    // Rollback to v1
    const rollbackRes = await app.inject({
      method: 'POST',
      url: `/api/v1/inbound-routes/${route.id}/rollback`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(rollbackRes.statusCode).toBe(200);
    const rolledBack = rollbackRes.json<{ data: { active_version_id: string } }>().data;
    expect(rolledBack.active_version_id).toBe(v1Id);
  });

  it('publish → 409 when version is not validated', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/inbound-routes',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Route', match_type: 'did', match_value: '+15550000002', target_type: 'flow' },
    });
    const route = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/inbound-routes/${route.id}/versions/${route.versions[0]!.id}/publish`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('validate → 422 when conflicting active route exists for same DID', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const flowId = await createActiveFlow(token, 'Conflict Flow');

    // Create and publish first route
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/v1/inbound-routes',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Route 1', match_type: 'did', match_value: '+15550001111', target_type: 'flow', target_id: flowId },
    });
    const route1 = r1.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
    const v1Id = route1.versions[0]!.id;
    await app.inject({ method: 'POST', url: `/api/v1/inbound-routes/${route1.id}/versions/${v1Id}/validate`, headers: { authorization: `Bearer ${token}` } });
    await app.inject({ method: 'POST', url: `/api/v1/inbound-routes/${route1.id}/versions/${v1Id}/publish`, headers: { authorization: `Bearer ${token}` } });

    // Create second route with the same DID
    const r2 = await app.inject({
      method: 'POST',
      url: '/api/v1/inbound-routes',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Route 2', match_type: 'did', match_value: '+15550001111', target_type: 'flow', target_id: flowId },
    });
    const route2 = r2.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
    const v2Id = route2.versions[0]!.id;

    // Validate should fail due to conflict
    const validateRes = await app.inject({
      method: 'POST',
      url: `/api/v1/inbound-routes/${route2.id}/versions/${v2Id}/validate`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(validateRes.statusCode).toBe(422);
    const body = validateRes.json<{ data: { outcome: { errors: Array<{ field: string }> } } }>();
    expect(body.data.outcome.errors.some((e) => e.field === 'match_value')).toBe(true);
  });

  it('tenant isolation: cannot see another tenant route', async () => {
    const token1 = await register(randomUUID().slice(0, 8));
    const token2 = await register(randomUUID().slice(0, 8));

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/inbound-routes',
      headers: { authorization: `Bearer ${token1}` },
      payload: { name: 'Private Route', match_type: 'did', match_value: '+15550009999', target_type: 'flow' },
    });
    const route = createRes.json<{ data: { id: string } }>().data;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/inbound-routes/${route.id}`,
      headers: { authorization: `Bearer ${token2}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
