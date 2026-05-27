import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

  const validDefinition = {
    nodes: [
      { id: 'start', type: 'play', prompt: 'Welcome to our system' },
      { id: 'menu', type: 'menu', options: { '1': 'sales', '2': 'support' } },
      { id: 'end', type: 'hangup' },
    ],
    entry_node_id: 'start',
  };

  const invalidDefinition = { greeting: 'hello' }; // missing nodes

  it('GET /ivr-flows → 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/ivr-flows' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /ivr-flows → creates flow with draft version 1', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Main Menu', description: 'Primary IVR', graph_json: validDefinition },
    });
    expect(res.statusCode).toBe(201);
    const { data } = res.json<{ data: Record<string, unknown> }>();
    expect(data['name']).toBe('Main Menu');
    expect(data['status']).toBe('draft');
    expect(data['draft_version_id']).toBeTruthy();
    expect(data['active_version_id']).toBeNull();
    const versions = data['versions'] as unknown[];
    expect(versions).toHaveLength(1);
    expect((versions[0] as Record<string, unknown>)['version_number']).toBe(1);
    expect((versions[0] as Record<string, unknown>)['state']).toBe('draft');
    expect((versions[0] as Record<string, unknown>)['graph_json']).toBeTruthy();
  });

  it('GET /ivr-flows/:id/versions → lists versions for the tenant flow', async () => {
    const token = await register(randomUUID().slice(0, 8));
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

  it('POST /ivr-flows/:id/versions/:vid/validate → 422 for invalid definition', async () => {
    const token = await register(randomUUID().slice(0, 8));
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

  it('POST /ivr-flows/:id/validate → validates the current draft version', async () => {
    const token = await register(randomUUID().slice(0, 8));
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

  it('full lifecycle: create → validate → publish → rollback', async () => {
    const token = await register(randomUUID().slice(0, 8));

    // Create
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Lifecycle Flow', definition: validDefinition },
    });
    expect(createRes.statusCode).toBe(201);
    const flow = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
    const v1Id = flow.versions[0]!.id;

    // Validate v1
    const validateRes = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/versions/${v1Id}/validate`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(validateRes.statusCode).toBe(200);
    const validateBody = validateRes.json<{ data: { outcome: { status: string }; version: { state: string } } }>();
    expect(validateBody.data.outcome.status).toBe('passed');
    expect(validateBody.data.version.state).toBe('validated');

    // Publish v1
    const publishRes = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/versions/${v1Id}/publish`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(publishRes.statusCode).toBe(200);
    const published = publishRes.json<{ data: { status: string; active_version_id: string } }>().data;
    expect(published.status).toBe('active');
    expect(published.active_version_id).toBe(v1Id);

    // Create v2 draft
    const v2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/versions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { definition: { ...validDefinition, entry_node_id: 'menu' } },
    });
    expect(v2Res.statusCode).toBe(201);
    const v2 = v2Res.json<{ data: { id: string; version_number: number; state: string } }>().data;
    expect(v2.version_number).toBe(2);
    expect(v2.state).toBe('draft');

    // Validate v2
    await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/versions/${v2.id}/validate`,
      headers: { authorization: `Bearer ${token}` },
    });

    // Publish v2 → v1 becomes superseded
    const publish2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/versions/${v2.id}/publish`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(publish2Res.statusCode).toBe(200);
    const published2 = publish2Res.json<{ data: { active_version_id: string } }>().data;
    expect(published2.active_version_id).toBe(v2.id);

    // Rollback → v1 becomes active again
    const rollbackRes = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/rollback`,
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

  it('rollback → 409 when no superseded version exists', async () => {
    const token = await register(randomUUID().slice(0, 8));
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

  it('GET /ivr-flows/:id → 404 for non-existent flow', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/ivr-flows/${randomUUID()}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('tenant isolation: cannot see another tenant flow', async () => {
    const token1 = await register(randomUUID().slice(0, 8));
    const token2 = await register(randomUUID().slice(0, 8));

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
