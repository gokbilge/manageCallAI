import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Disposition codes and call notes (#278)', () => {
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

  async function register(suf: string) {
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
    const body = res.json<{ token: string }>();
    const payload = JSON.parse(Buffer.from(body.token.split('.')[1]!, 'base64url').toString()) as { tenant_id: string };
    return { token: body.token, tenantId: payload.tenant_id };
  }

  // ── Disposition codes ──────────────────────────────────────────────────────

  describe('POST /api/v1/disposition-codes', () => {
    it('creates a disposition code', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/disposition-codes',
        headers: { authorization: `Bearer ${token}` },
        payload: { code: 'RESOLVED', label: 'Resolved', description: 'Call fully resolved' },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json<{ data: { code: string; is_active: boolean } }>();
      expect(body.data.code).toBe('RESOLVED');
      expect(body.data.is_active).toBe(true);
    });

    it('returns 400 for duplicate code', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      await app.inject({
        method: 'POST',
        url: '/api/v1/disposition-codes',
        headers: { authorization: `Bearer ${token}` },
        payload: { code: 'RESOLVED', label: 'Resolved' },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/disposition-codes',
        headers: { authorization: `Bearer ${token}` },
        payload: { code: 'RESOLVED', label: 'Resolved again' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/disposition-codes',
        payload: { code: 'X', label: 'X' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('enforces tenant isolation — code from tenant A not visible to tenant B', async () => {
      const { token: tokenA, tenantId: tidA } = await register(randomUUID().slice(0, 8));
      const { token: tokenB } = await register(randomUUID().slice(0, 8));
      await app.inject({
        method: 'POST',
        url: '/api/v1/disposition-codes',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { code: 'RESOLVED', label: 'Resolved' },
      });
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/disposition-codes',
        headers: { authorization: `Bearer ${tokenB}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: unknown[] }>().data).toHaveLength(0);
      void tidA;
    });
  });

  describe('GET /api/v1/disposition-codes', () => {
    it('lists codes for tenant', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      await app.inject({
        method: 'POST', url: '/api/v1/disposition-codes',
        headers: { authorization: `Bearer ${token}` },
        payload: { code: 'RESOLVED', label: 'Resolved' },
      });
      const res = await app.inject({
        method: 'GET', url: '/api/v1/disposition-codes',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: unknown[] }>().data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PATCH /api/v1/disposition-codes/:id', () => {
    it('deactivates a code', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const created = await app.inject({
        method: 'POST', url: '/api/v1/disposition-codes',
        headers: { authorization: `Bearer ${token}` },
        payload: { code: 'RESOLVED', label: 'Resolved' },
      });
      const id = created.json<{ data: { id: string } }>().data.id;
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/disposition-codes/${id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { is_active: false },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: { is_active: boolean } }>().data.is_active).toBe(false);
    });
  });

  // ── Call disposition capture ───────────────────────────────────────────────

  describe('PUT /api/v1/calls/:callId/disposition', () => {
    it('records and retrieves a disposition', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const codeRes = await app.inject({
        method: 'POST', url: '/api/v1/disposition-codes',
        headers: { authorization: `Bearer ${token}` },
        payload: { code: 'RESOLVED', label: 'Resolved' },
      });
      const codeId = codeRes.json<{ data: { id: string } }>().data.id;
      const callId = `call-${randomUUID().slice(0, 8)}`;

      const putRes = await app.inject({
        method: 'PUT', url: `/api/v1/calls/${callId}/disposition`,
        headers: { authorization: `Bearer ${token}` },
        payload: { disposition_code_id: codeId, note: 'Customer satisfied' },
      });
      expect(putRes.statusCode).toBe(200);

      const getRes = await app.inject({
        method: 'GET', url: `/api/v1/calls/${callId}/disposition`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getRes.statusCode).toBe(200);
      const body = getRes.json<{ data: { code: string; note: string } }>();
      expect(body.data.code).toBe('RESOLVED');
      expect(body.data.note).toBe('Customer satisfied');
    });

    it('returns 404 when no disposition exists', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'GET', url: `/api/v1/calls/no-such-call/disposition`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when code is inactive', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const codeRes = await app.inject({
        method: 'POST', url: '/api/v1/disposition-codes',
        headers: { authorization: `Bearer ${token}` },
        payload: { code: 'OLD', label: 'Old' },
      });
      const codeId = codeRes.json<{ data: { id: string } }>().data.id;
      await app.inject({
        method: 'PATCH', url: `/api/v1/disposition-codes/${codeId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { is_active: false },
      });
      const res = await app.inject({
        method: 'PUT', url: `/api/v1/calls/call-x/disposition`,
        headers: { authorization: `Bearer ${token}` },
        payload: { disposition_code_id: codeId },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── Call notes ─────────────────────────────────────────────────────────────

  describe('POST /api/v1/calls/:callId/notes', () => {
    it('creates and lists notes', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const callId = `call-${randomUUID().slice(0, 8)}`;

      const postRes = await app.inject({
        method: 'POST', url: `/api/v1/calls/${callId}/notes`,
        headers: { authorization: `Bearer ${token}` },
        payload: { content: 'Customer asked about pricing.' },
      });
      expect(postRes.statusCode).toBe(201);

      const listRes = await app.inject({
        method: 'GET', url: `/api/v1/calls/${callId}/notes`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(listRes.statusCode).toBe(200);
      const data = listRes.json<{ data: Array<{ content: string }> }>();
      expect(data.data[0]?.content).toBe('Customer asked about pricing.');
    });

    it('allows multiple notes per call', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const callId = `call-${randomUUID().slice(0, 8)}`;
      await app.inject({ method: 'POST', url: `/api/v1/calls/${callId}/notes`, headers: { authorization: `Bearer ${token}` }, payload: { content: 'Note 1' } });
      await app.inject({ method: 'POST', url: `/api/v1/calls/${callId}/notes`, headers: { authorization: `Bearer ${token}` }, payload: { content: 'Note 2' } });
      const res = await app.inject({ method: 'GET', url: `/api/v1/calls/${callId}/notes`, headers: { authorization: `Bearer ${token}` } });
      expect(res.json<{ data: unknown[] }>().data).toHaveLength(2);
    });
  });

  describe('PATCH /api/v1/calls/:callId/notes/:noteId', () => {
    it('updates own note', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const callId = `call-${randomUUID().slice(0, 8)}`;
      const noteRes = await app.inject({
        method: 'POST', url: `/api/v1/calls/${callId}/notes`,
        headers: { authorization: `Bearer ${token}` },
        payload: { content: 'Original' },
      });
      const noteId = noteRes.json<{ data: { id: string } }>().data.id;
      const patchRes = await app.inject({
        method: 'PATCH', url: `/api/v1/calls/${callId}/notes/${noteId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { content: 'Updated content' },
      });
      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json<{ data: { content: string } }>().data.content).toBe('Updated content');
    });
  });

  describe('DELETE /api/v1/calls/:callId/notes/:noteId', () => {
    it('deletes own note', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const callId = `call-${randomUUID().slice(0, 8)}`;
      const noteRes = await app.inject({
        method: 'POST', url: `/api/v1/calls/${callId}/notes`,
        headers: { authorization: `Bearer ${token}` },
        payload: { content: 'To be deleted' },
      });
      const noteId = noteRes.json<{ data: { id: string } }>().data.id;
      const delRes = await app.inject({
        method: 'DELETE', url: `/api/v1/calls/${callId}/notes/${noteId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(delRes.statusCode).toBe(204);
      const listRes = await app.inject({ method: 'GET', url: `/api/v1/calls/${callId}/notes`, headers: { authorization: `Bearer ${token}` } });
      expect(listRes.json<{ data: unknown[] }>().data).toHaveLength(0);
    });
  });
});
