import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Line appearances and device assignments (#314–#315)', () => {
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

  async function createExtension(token: string, number: string): Promise<string> {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/extensions',
      headers: { authorization: `Bearer ${token}` },
      payload: { extension_number: number, display_name: `Ext ${number}`, sip_username: `sip${number}`, sip_password: 'Secret456!' },
    });
    return res.json<{ data: { id: string } }>().data.id;
  }

  async function createDevice(token: string, name: string): Promise<string> {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/devices',
      headers: { authorization: `Bearer ${token}` },
      payload: { name, device_type: 'desk_phone' },
    });
    return res.json<{ data: { id: string } }>().data.id;
  }

  async function createAppearance(token: string, extensionId: string, label: string, index = 0): Promise<string> {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/line-appearances',
      headers: { authorization: `Bearer ${token}` },
      payload: { extension_id: extensionId, label, appearance_index: index },
    });
    expect(res.statusCode).toBe(201);
    return res.json<{ data: { id: string } }>().data.id;
  }

  // ── Line appearances (#314) ───────────────────────────────────────────────

  describe('GET /api/v1/line-appearances', () => {
    it('returns 401 without auth', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/line-appearances' });
      expect(res.statusCode).toBe(401);
    });

    it('lists appearances (empty initially)', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const res = await app.inject({ method: 'GET', url: '/api/v1/line-appearances', headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: unknown[] }>().data).toHaveLength(0);
    });
  });

  describe('POST /api/v1/line-appearances', () => {
    it('creates a line appearance', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const extId = await createExtension(token, '2000');
      const res = await app.inject({
        method: 'POST', url: '/api/v1/line-appearances',
        headers: { authorization: `Bearer ${token}` },
        payload: { extension_id: extId, label: 'Primary Line', appearance_index: 0 },
      });
      expect(res.statusCode).toBe(201);
      const la = res.json<{ data: { label: string; appearance_index: number; status: string } }>().data;
      expect(la.label).toBe('Primary Line');
      expect(la.appearance_index).toBe(0);
      expect(la.status).toBe('active');
    });

    it('creates multiple appearances for the same extension', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const extId = await createExtension(token, '2001');
      await createAppearance(token, extId, 'Line A', 0);
      await createAppearance(token, extId, 'Line B', 1);

      const res = await app.inject({
        method: 'GET', url: `/api/v1/line-appearances?extension_id=${extId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: unknown[] }>().data).toHaveLength(2);
    });
  });

  describe('GET /api/v1/line-appearances/:id', () => {
    it('gets an appearance by id', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const extId = await createExtension(token, '2002');
      const laId = await createAppearance(token, extId, 'My Line');
      const res = await app.inject({ method: 'GET', url: `/api/v1/line-appearances/${laId}`, headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: { label: string } }>().data.label).toBe('My Line');
    });

    it('returns 404 for unknown appearance', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const res = await app.inject({ method: 'GET', url: `/api/v1/line-appearances/${randomUUID()}`, headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/v1/line-appearances/:id', () => {
    it('updates an appearance label and status', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const extId = await createExtension(token, '2003');
      const laId = await createAppearance(token, extId, 'Old Label');
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/line-appearances/${laId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { label: 'New Label', status: 'inactive' },
      });
      expect(res.statusCode).toBe(200);
      const la = res.json<{ data: { label: string; status: string } }>().data;
      expect(la.label).toBe('New Label');
      expect(la.status).toBe('inactive');
    });
  });

  describe('DELETE /api/v1/line-appearances/:id', () => {
    it('deletes an appearance', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const extId = await createExtension(token, '2004');
      const laId = await createAppearance(token, extId, 'ToDelete');
      const delRes = await app.inject({ method: 'DELETE', url: `/api/v1/line-appearances/${laId}`, headers: { authorization: `Bearer ${token}` } });
      expect(delRes.statusCode).toBe(204);
      const getRes = await app.inject({ method: 'GET', url: `/api/v1/line-appearances/${laId}`, headers: { authorization: `Bearer ${token}` } });
      expect(getRes.statusCode).toBe(404);
    });
  });

  // ── Device appearance assignments (#315) ──────────────────────────────────

  describe('POST /api/v1/line-appearances/:id/device-assignments', () => {
    it('assigns an appearance to a device button', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const extId = await createExtension(token, '2005');
      const devId = await createDevice(token, 'PhoneA');
      const laId = await createAppearance(token, extId, 'Button Line');

      const res = await app.inject({
        method: 'POST', url: `/api/v1/line-appearances/${laId}/device-assignments`,
        headers: { authorization: `Bearer ${token}` },
        payload: { device_id: devId, button_index: 1 },
      });
      expect(res.statusCode).toBe(201);
      const assign = res.json<{ data: { device_id: string; button_index: number } }>().data;
      expect(assign.device_id).toBe(devId);
      expect(assign.button_index).toBe(1);
    });

    it('lists device assignments for an appearance', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const extId = await createExtension(token, '2006');
      const devId = await createDevice(token, 'PhoneB');
      const laId = await createAppearance(token, extId, 'Listed Line');

      await app.inject({
        method: 'POST', url: `/api/v1/line-appearances/${laId}/device-assignments`,
        headers: { authorization: `Bearer ${token}` },
        payload: { device_id: devId, button_index: 0 },
      });

      const res = await app.inject({ method: 'GET', url: `/api/v1/line-appearances/${laId}/device-assignments`, headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: unknown[] }>().data).toHaveLength(1);
    });

    it('removes a device appearance assignment', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const extId = await createExtension(token, '2007');
      const devId = await createDevice(token, 'PhoneC');
      const laId = await createAppearance(token, extId, 'Remove Line');

      const assignRes = await app.inject({
        method: 'POST', url: `/api/v1/line-appearances/${laId}/device-assignments`,
        headers: { authorization: `Bearer ${token}` },
        payload: { device_id: devId, button_index: 2 },
      });
      const assignId: string = assignRes.json<{ data: { id: string } }>().data.id;

      const delRes = await app.inject({ method: 'DELETE', url: `/api/v1/line-appearances/${laId}/device-assignments/${assignId}`, headers: { authorization: `Bearer ${token}` } });
      expect(delRes.statusCode).toBe(204);
    });

    it('returns 404 when removing missing assignment', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const extId = await createExtension(token, '2008');
      const laId = await createAppearance(token, extId, 'Not Found Line');
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/line-appearances/${laId}/device-assignments/${randomUUID()}`, headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/devices/:id/appearance-assignments', () => {
    it('lists appearance assignments for a device', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const extId = await createExtension(token, '2009');
      const devId = await createDevice(token, 'PhoneD');
      const laId = await createAppearance(token, extId, 'Device View');

      await app.inject({
        method: 'POST', url: `/api/v1/line-appearances/${laId}/device-assignments`,
        headers: { authorization: `Bearer ${token}` },
        payload: { device_id: devId, button_index: 0 },
      });

      const res = await app.inject({ method: 'GET', url: `/api/v1/devices/${devId}/appearance-assignments`, headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: unknown[] }>().data).toHaveLength(1);
    });
  });

  describe('Tenant isolation', () => {
    it('cannot see another tenant line appearance', async () => {
      const t1 = await register(randomUUID().slice(0, 8));
      const t2 = await register(randomUUID().slice(0, 8));
      const extId = await createExtension(t1, '2010');
      const laId = await createAppearance(t1, extId, 'Isolated');

      const res = await app.inject({ method: 'GET', url: `/api/v1/line-appearances/${laId}`, headers: { authorization: `Bearer ${t2}` } });
      expect(res.statusCode).toBe(404);
    });
  });
});
