import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Trunk groups, route lists, and carrier resolution (#305–#307)', () => {
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

  afterAll(async () => { await app.close(); await db.end(); });
  beforeEach(async () => { await db.query('TRUNCATE TABLE tenants CASCADE'); });

  async function register(suf: string): Promise<string> {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/register',
      payload: { tenant_name: `T ${suf}`, tenant_slug: `t-${suf}`, email: `u-${suf}@x.com`, display_name: 'T', password: 'Secret123!' },
    });
    return res.json<{ token: string }>().token;
  }

  async function createTrunk(token: string, name: string): Promise<string> {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/sip-trunks',
      headers: { authorization: `Bearer ${token}` },
      payload: { name, direction: 'outbound', realm: 'sip.carrier.example', proxy: 'sip.carrier.example', auth_username: 'user', auth_password: 'Secret456!', transport: 'udp' },
    });
    return res.json<{ data: { id: string } }>().data.id;
  }

  // ── Trunk groups (#305) ────────────────────────────────────────────────────

  describe('POST /api/v1/trunk-groups', () => {
    it('creates a trunk group and adds a member trunk', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const trunkId = await createTrunk(token, 'Carrier A');

      const createRes = await app.inject({
        method: 'POST', url: '/api/v1/trunk-groups',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Primary Carriers', selection_strategy: 'priority' },
      });
      expect(createRes.statusCode).toBe(201);
      const group = createRes.json<{ data: { id: string; selection_strategy: string } }>().data;
      expect(group.selection_strategy).toBe('priority');

      const memberRes = await app.inject({
        method: 'POST', url: `/api/v1/trunk-groups/${group.id}/members`,
        headers: { authorization: `Bearer ${token}` },
        payload: { trunk_id: trunkId, priority: 100 },
      });
      expect(memberRes.statusCode).toBe(201);
      expect(memberRes.json<{ data: { trunk_id: string } }>().data.trunk_id).toBe(trunkId);

      // Get with members
      const getRes = await app.inject({ method: 'GET', url: `/api/v1/trunk-groups/${group.id}`, headers: { authorization: `Bearer ${token}` } });
      expect(getRes.statusCode).toBe(200);
      const full = getRes.json<{ data: { members: unknown[] } }>().data;
      expect(full.members).toHaveLength(1);
    });

    it('lists trunk groups', async () => {
      const token = await register(randomUUID().slice(0, 8));
      await app.inject({ method: 'POST', url: '/api/v1/trunk-groups', headers: { authorization: `Bearer ${token}` }, payload: { name: 'G1' } });
      const res = await app.inject({ method: 'GET', url: '/api/v1/trunk-groups', headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: unknown[] }>().data.length).toBeGreaterThan(0);
    });

    it('returns 404 for unknown trunk group', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const res = await app.inject({ method: 'GET', url: `/api/v1/trunk-groups/${randomUUID()}`, headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(404);
    });

    it('patches a trunk group', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({ method: 'POST', url: '/api/v1/trunk-groups', headers: { authorization: `Bearer ${token}` }, payload: { name: 'Old' } });
      const groupId = createRes.json<{ data: { id: string } }>().data.id;
      const patchRes = await app.inject({ method: 'PATCH', url: `/api/v1/trunk-groups/${groupId}`, headers: { authorization: `Bearer ${token}` }, payload: { name: 'New', selection_strategy: 'round_robin' } });
      expect(patchRes.statusCode).toBe(200);
    });

    it('deletes a trunk group', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({ method: 'POST', url: '/api/v1/trunk-groups', headers: { authorization: `Bearer ${token}` }, payload: { name: 'ToDelete' } });
      const groupId = createRes.json<{ data: { id: string } }>().data.id;
      const delRes = await app.inject({ method: 'DELETE', url: `/api/v1/trunk-groups/${groupId}`, headers: { authorization: `Bearer ${token}` } });
      expect(delRes.statusCode).toBe(204);
    });

    it('removes a member from a trunk group', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const trunkId = await createTrunk(token, 'ToRemove');
      const createRes = await app.inject({ method: 'POST', url: '/api/v1/trunk-groups', headers: { authorization: `Bearer ${token}` }, payload: { name: 'RemoveTest' } });
      const groupId = createRes.json<{ data: { id: string } }>().data.id;
      const memberRes = await app.inject({ method: 'POST', url: `/api/v1/trunk-groups/${groupId}/members`, headers: { authorization: `Bearer ${token}` }, payload: { trunk_id: trunkId } });
      const memberId = memberRes.json<{ data: { id: string } }>().data.id;
      const delRes = await app.inject({ method: 'DELETE', url: `/api/v1/trunk-groups/${groupId}/members/${memberId}`, headers: { authorization: `Bearer ${token}` } });
      expect(delRes.statusCode).toBe(204);
    });
  });

  // ── Failover-aware simulation (#306) ──────────────────────────────────────

  describe('POST /api/v1/trunk-groups/:id/simulate', () => {
    it('simulates routing — no trunks when group empty', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({ method: 'POST', url: '/api/v1/trunk-groups', headers: { authorization: `Bearer ${token}` }, payload: { name: 'Empty Group' } });
      const groupId = createRes.json<{ data: { id: string } }>().data.id;

      const simRes = await app.inject({
        method: 'POST', url: `/api/v1/trunk-groups/${groupId}/simulate`,
        headers: { authorization: `Bearer ${token}` },
        payload: { dial_string: '+14155551234' },
      });
      expect(simRes.statusCode).toBe(200);
      const body = simRes.json<{ data: { outcome: string; is_advisory: boolean } }>();
      expect(body.data.outcome).toBe('no_trunks');
      expect(body.data.is_advisory).toBe(true);
    });

    it('simulates routing — routed when active trunk present', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const trunkId = await createTrunk(token, 'Active Carrier');

      const createRes = await app.inject({ method: 'POST', url: '/api/v1/trunk-groups', headers: { authorization: `Bearer ${token}` }, payload: { name: 'Active Group' } });
      const groupId = createRes.json<{ data: { id: string } }>().data.id;
      await app.inject({ method: 'POST', url: `/api/v1/trunk-groups/${groupId}/members`, headers: { authorization: `Bearer ${token}` }, payload: { trunk_id: trunkId, priority: 100 } });

      const simRes = await app.inject({
        method: 'POST', url: `/api/v1/trunk-groups/${groupId}/simulate`,
        headers: { authorization: `Bearer ${token}` },
        payload: { dial_string: '+14155551234' },
      });
      expect(simRes.statusCode).toBe(200);
      const body = simRes.json<{ data: { outcome: string; steps: Array<{ role: string }> } }>();
      expect(body.data.outcome).toBe('routed');
      expect(body.data.steps[0]!.role).toBe('primary');
    });
  });

  // ── Route lists (#305) ────────────────────────────────────────────────────

  describe('POST /api/v1/route-lists', () => {
    it('creates a route list and adds an entry', async () => {
      const token = await register(randomUUID().slice(0, 8));

      const createRes = await app.inject({
        method: 'POST', url: '/api/v1/route-lists',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Failover List' },
      });
      expect(createRes.statusCode).toBe(201);
      const list = createRes.json<{ data: { id: string } }>().data;

      const trunkId = await createTrunk(token, 'Entry Trunk');
      const entryRes = await app.inject({
        method: 'POST', url: `/api/v1/route-lists/${list.id}/entries`,
        headers: { authorization: `Bearer ${token}` },
        payload: { entry_type: 'sip_trunk', entry_id: trunkId, priority: 100 },
      });
      expect(entryRes.statusCode).toBe(201);

      const getRes = await app.inject({ method: 'GET', url: `/api/v1/route-lists/${list.id}`, headers: { authorization: `Bearer ${token}` } });
      expect(getRes.statusCode).toBe(200);
      expect(getRes.json<{ data: { entries: unknown[] } }>().data.entries).toHaveLength(1);
    });

    it('lists route lists', async () => {
      const token = await register(randomUUID().slice(0, 8));
      await app.inject({ method: 'POST', url: '/api/v1/route-lists', headers: { authorization: `Bearer ${token}` }, payload: { name: 'List A' } });
      const res = await app.inject({ method: 'GET', url: '/api/v1/route-lists', headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: unknown[] }>().data.length).toBeGreaterThan(0);
    });

    it('deletes a route list', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({ method: 'POST', url: '/api/v1/route-lists', headers: { authorization: `Bearer ${token}` }, payload: { name: 'ToDelete' } });
      const listId = createRes.json<{ data: { id: string } }>().data.id;
      const delRes = await app.inject({ method: 'DELETE', url: `/api/v1/route-lists/${listId}`, headers: { authorization: `Bearer ${token}` } });
      expect(delRes.statusCode).toBe(204);
    });
  });

  // ── Site-aware carrier resolution (#307) ──────────────────────────────────

  describe('POST /api/v1/outbound-routing/resolve', () => {
    it('resolves carrier — no site, global routing', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'POST', url: '/api/v1/outbound-routing/resolve',
        headers: { authorization: `Bearer ${token}` },
        payload: { dial_string: '+14155551234' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { site_id: null; is_advisory: boolean; resolution_path: string[] } }>();
      expect(body.data.site_id).toBeNull();
      expect(body.data.is_advisory).toBe(true);
      expect(body.data.resolution_path[0]).toContain('No site');
    });

    it('resolves carrier — unknown site_id falls back gracefully', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'POST', url: '/api/v1/outbound-routing/resolve',
        headers: { authorization: `Bearer ${token}` },
        payload: { dial_string: '+14155551234', site_id: randomUUID() },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { resolved_trunk_id: null; resolution_path: string[] } }>();
      expect(body.data.resolved_trunk_id).toBeNull();
    });
  });
});
