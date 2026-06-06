import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Devices, registrations, and assignments (#308–#310)', () => {
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
      payload: { name, device_type: 'desk_phone', sip_username: `sip-${name}` },
    });
    expect(res.statusCode).toBe(201);
    return res.json<{ data: { id: string } }>().data.id;
  }

  // ── Device CRUD (#308) ────────────────────────────────────────────────────

  describe('GET /api/v1/devices', () => {
    it('returns 401 without auth', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/devices' });
      expect(res.statusCode).toBe(401);
    });

    it('lists devices (empty initially)', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const res = await app.inject({ method: 'GET', url: '/api/v1/devices', headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: unknown[] }>().data).toHaveLength(0);
    });
  });

  describe('POST /api/v1/devices', () => {
    it('creates a device', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'POST', url: '/api/v1/devices',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Phone A', device_type: 'desk_phone', mac_address: '00:11:22:33:44:55', sip_username: 'phone-a', sip_password: 'Secret456!', metadata: { location: 'office' } },
      });
      expect(res.statusCode).toBe(201);
      const dev = res.json<{ data: { name: string; device_type: string; status: string } }>().data;
      expect(dev.name).toBe('Phone A');
      expect(dev.device_type).toBe('desk_phone');
      expect(dev.status).toBe('active');
    });

    it('creates a device without optional fields', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'POST', url: '/api/v1/devices',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Minimal Device' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json<{ data: { device_type: string } }>().data.device_type).toBe('other');
    });
  });

  describe('GET /api/v1/devices/:id', () => {
    it('gets a device by id', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const devId = await createDevice(token, 'GetTest');
      const res = await app.inject({ method: 'GET', url: `/api/v1/devices/${devId}`, headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: { name: string } }>().data.name).toBe('GetTest');
    });

    it('returns 404 for unknown device', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const res = await app.inject({ method: 'GET', url: `/api/v1/devices/${randomUUID()}`, headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/v1/devices/:id', () => {
    it('updates a device name and status', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const devId = await createDevice(token, 'PatchMe');
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/devices/${devId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Updated', status: 'inactive' },
      });
      expect(res.statusCode).toBe(200);
      const dev = res.json<{ data: { name: string; status: string } }>().data;
      expect(dev.name).toBe('Updated');
      expect(dev.status).toBe('inactive');
    });
  });

  describe('POST /api/v1/devices/:id/deprovision', () => {
    it('deprovisions a device', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const devId = await createDevice(token, 'Deprovision');
      const res = await app.inject({ method: 'POST', url: `/api/v1/devices/${devId}/deprovision`, headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: { status: string } }>().data.status).toBe('deprovisioned');
    });
  });

  describe('DELETE /api/v1/devices/:id', () => {
    it('deletes a device', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const devId = await createDevice(token, 'DeleteMe');
      const delRes = await app.inject({ method: 'DELETE', url: `/api/v1/devices/${devId}`, headers: { authorization: `Bearer ${token}` } });
      expect(delRes.statusCode).toBe(204);
      const getRes = await app.inject({ method: 'GET', url: `/api/v1/devices/${devId}`, headers: { authorization: `Bearer ${token}` } });
      expect(getRes.statusCode).toBe(404);
    });
  });

  // ── Registrations (#309) ──────────────────────────────────────────────────

  describe('POST /api/v1/registrations (runtime)', () => {
    it('records a SIP registration via runtime token', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const devId = await createDevice(token, 'RegDevice');
      const devRes = await app.inject({ method: 'GET', url: `/api/v1/devices/${devId}`, headers: { authorization: `Bearer ${token}` } });
      const tenantId: string = devRes.json<{ data: { tenant_id: string } }>().data.tenant_id;

      const res = await app.inject({
        method: 'POST', url: '/api/v1/registrations',
        headers: { 'x-managecallai-runtime-token': 'test-runtime-token' },
        payload: { tenant_id: tenantId, sip_username: 'sip-RegDevice', device_id: devId, contact_uri: 'sip:phone@192.0.2.1:5060' },
      });
      expect(res.statusCode).toBe(201);
      const reg = res.json<{ data: { sip_username: string; is_active: boolean } }>().data;
      expect(reg.sip_username).toBe('sip-RegDevice');
      expect(reg.is_active).toBe(true);
    });

    it('lists registrations for a device', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const devId = await createDevice(token, 'ListReg');
      const listRes = await app.inject({ method: 'GET', url: `/api/v1/devices/${devId}/registrations`, headers: { authorization: `Bearer ${token}` } });
      expect(listRes.statusCode).toBe(200);
      expect(Array.isArray(listRes.json<{ data: unknown[] }>().data)).toBe(true);
    });
  });

  describe('GET /api/v1/registrations (operator query)', () => {
    it('lists registrations with device_id filter', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const devId = await createDevice(token, 'QueryReg');
      const res = await app.inject({
        method: 'GET', url: `/api/v1/registrations?device_id=${devId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json<{ data: unknown[] }>().data)).toBe(true);
    });
  });

  // ── Assignments (#310) ────────────────────────────────────────────────────

  describe('POST /api/v1/extensions/:id/assignments', () => {
    it('assigns a device to an extension and lists it', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const extId = await createExtension(token, '1000');
      const devId = await createDevice(token, 'AssignDevice');

      const assignRes = await app.inject({
        method: 'POST', url: `/api/v1/extensions/${extId}/assignments`,
        headers: { authorization: `Bearer ${token}` },
        payload: { assignable_type: 'device', assignable_id: devId, is_primary: true },
      });
      expect(assignRes.statusCode).toBe(201);
      const a = assignRes.json<{ data: { assignable_type: string; is_primary: boolean } }>().data;
      expect(a.assignable_type).toBe('device');
      expect(a.is_primary).toBe(true);

      const listRes = await app.inject({ method: 'GET', url: `/api/v1/extensions/${extId}/assignments`, headers: { authorization: `Bearer ${token}` } });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json<{ data: unknown[] }>().data).toHaveLength(1);
    });

    it('removes an assignment', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const extId = await createExtension(token, '1001');
      const devId = await createDevice(token, 'RemoveAssign');

      const assignRes = await app.inject({
        method: 'POST', url: `/api/v1/extensions/${extId}/assignments`,
        headers: { authorization: `Bearer ${token}` },
        payload: { assignable_type: 'device', assignable_id: devId },
      });
      const assignId: string = assignRes.json<{ data: { id: string } }>().data.id;

      const delRes = await app.inject({ method: 'DELETE', url: `/api/v1/extensions/${extId}/assignments/${assignId}`, headers: { authorization: `Bearer ${token}` } });
      expect(delRes.statusCode).toBe(204);
    });

    it('returns 404 when removing missing assignment', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const extId = await createExtension(token, '1002');
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/extensions/${extId}/assignments/${randomUUID()}`, headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/devices/:id/assignments', () => {
    it('lists device assignments by device id', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const extId = await createExtension(token, '1003');
      const devId = await createDevice(token, 'DevAssign');

      await app.inject({
        method: 'POST', url: `/api/v1/extensions/${extId}/assignments`,
        headers: { authorization: `Bearer ${token}` },
        payload: { assignable_type: 'device', assignable_id: devId },
      });

      const res = await app.inject({ method: 'GET', url: `/api/v1/devices/${devId}/assignments`, headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: unknown[] }>().data).toHaveLength(1);
    });
  });

  describe('Tenant isolation', () => {
    it('cannot see another tenant device', async () => {
      const t1 = await register(randomUUID().slice(0, 8));
      const t2 = await register(randomUUID().slice(0, 8));
      const devId = await createDevice(t1, 'TenantIsolated');

      const res = await app.inject({ method: 'GET', url: `/api/v1/devices/${devId}`, headers: { authorization: `Bearer ${t2}` } });
      expect(res.statusCode).toBe(404);
    });
  });
});
