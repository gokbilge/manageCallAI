import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Node Status API integration', () => {
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
    await db.query('TRUNCATE TABLE freeswitch_nodes CASCADE');
    await db.query('TRUNCATE TABLE tenants CASCADE');
  });

  async function createNode(): Promise<string> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO freeswitch_nodes (display_name, token_encrypted, token_key_id)
       VALUES ('Test Node', 'enc-token', 'key-1') RETURNING id`,
    );
    return r.rows[0]!.id;
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

  it('POST /platform/nodes/:id/status-snapshot -> 401 without auth', async () => {
    const nodeId = await createNode();
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/platform/nodes/${nodeId}/status-snapshot`,
      payload: { node_id: nodeId, loaded_modules: ['mod_sofia'] },
    });
    expect(res.statusCode).toBe(401);
  });

  it('Go agent pushes status snapshot — stored in DB', async () => {
    const nodeId = await createNode();

    const push = await app.inject({
      method: 'POST',
      url: `/api/v1/platform/nodes/${nodeId}/status-snapshot`,
      headers: { authorization: `Bearer ${process.env.RUNTIME_API_TOKEN}` },
      payload: {
        node_id: nodeId,
        freeswitch_version: 'FreeSWITCH Version 1.10.11',
        loaded_modules: ['mod_sofia', 'mod_event_socket', 'mod_xml_curl', 'mod_lua', 'mod_dptools'],
        missing_required_modules: [],
        sofia_profiles: { internal: { state: 'RUNNING' }, external: { state: 'RUNNING' } },
        gateway_statuses: { 'trunk-abc': { state: 'REGED' } },
        active_channel_count: 3,
        active_registration_count: 10,
      },
    });
    expect(push.statusCode).toBe(200);

    const snap = await db.query(
      'SELECT freeswitch_version, active_channel_count FROM freeswitch_node_status_snapshots WHERE node_id = $1',
      [nodeId],
    );
    expect(snap.rows).toHaveLength(1);
    expect(snap.rows[0].freeswitch_version).toBe('FreeSWITCH Version 1.10.11');
    expect(snap.rows[0].active_channel_count).toBe(3);
  });

  it('upsert: second push overwrites first snapshot', async () => {
    const nodeId = await createNode();
    const pushSnapshot = (count: number) => app.inject({
      method: 'POST',
      url: `/api/v1/platform/nodes/${nodeId}/status-snapshot`,
      headers: { authorization: `Bearer ${process.env.RUNTIME_API_TOKEN}` },
      payload: {
        node_id: nodeId,
        active_channel_count: count,
        loaded_modules: [],
        missing_required_modules: [],
        sofia_profiles: {},
        gateway_statuses: {},
      },
    });
    await pushSnapshot(2);
    await pushSnapshot(5);

    const snap = await db.query(
      'SELECT active_channel_count FROM freeswitch_node_status_snapshots WHERE node_id = $1',
      [nodeId],
    );
    expect(snap.rows).toHaveLength(1);
    expect(snap.rows[0].active_channel_count).toBe(5);
  });

  it('GET /platform/nodes/:id/status -> 403 for tenant_admin (platform_admin only)', async () => {
    const nodeId = await createNode();
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/platform/nodes/${nodeId}/status`,
      headers: { authorization: `Bearer ${token}` },
    });
    // platform_admin is JWT-only; tenant_admin receives 403
    expect(res.statusCode).toBe(403);
  });

  it('GET /platform/nodes/:id/modules -> 403 for tenant_admin', async () => {
    const nodeId = await createNode();
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/platform/nodes/${nodeId}/modules`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /platform/nodes/:id/gateways -> 403 for tenant_admin', async () => {
    const nodeId = await createNode();
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/platform/nodes/${nodeId}/gateways`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /platform/nodes/:id/channels -> 403 for tenant_admin', async () => {
    const nodeId = await createNode();
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/platform/nodes/${nodeId}/channels`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /platform/nodes/:id/registrations -> 403 for tenant_admin', async () => {
    const nodeId = await createNode();
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/platform/nodes/${nodeId}/registrations`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /runtime/gateway-status -> 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/runtime/gateway-status' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /runtime/gateway-status -> 200 for authenticated tenant', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/gateway-status',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: unknown[] }>().data).toBeInstanceOf(Array);
  });
});
