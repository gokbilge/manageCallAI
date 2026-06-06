import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Supervisor artifact search (#280)', () => {
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
    const payload = JSON.parse(Buffer.from(body.token.split('.')[1]!, 'base64url').toString()) as { tenant_id: string; sub: string };
    return { token: body.token, tenantId: payload.tenant_id, userId: payload.sub };
  }

  async function seedNote(tenantId: string, authorUserId: string, callId: string, content: string) {
    await db.query(
      `INSERT INTO call_notes (tenant_id, call_id, author_user_id, content) VALUES ($1, $2, $3, $4)`,
      [tenantId, callId, authorUserId, content],
    );
  }

  async function seedDisposition(tenantId: string, callId: string, authorUserId: string, code: string, label: string) {
    const codeRes = await db.query<{ id: string }>(
      `INSERT INTO disposition_codes (tenant_id, code, label) VALUES ($1, $2, $3) ON CONFLICT (tenant_id, code) DO UPDATE SET label = EXCLUDED.label RETURNING id`,
      [tenantId, code, label],
    );
    const codeId = codeRes.rows[0]!.id;
    await db.query(
      `INSERT INTO call_dispositions (tenant_id, call_id, disposition_code_id, recorded_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, call_id) DO UPDATE SET disposition_code_id = EXCLUDED.disposition_code_id`,
      [tenantId, callId, codeId, authorUserId],
    );
  }

  describe('POST /api/v1/supervisor/search', () => {
    it('returns empty when nothing matches', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'POST', url: '/api/v1/supervisor/search',
        headers: { authorization: `Bearer ${token}` },
        payload: { query: 'billing' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { total: number; results: unknown[] } }>();
      expect(body.data.total).toBe(0);
      expect(body.data.results).toHaveLength(0);
    });

    it('finds call notes matching the query', async () => {
      const { token, tenantId, userId } = await register(randomUUID().slice(0, 8));
      const callId = `call-${randomUUID().slice(0, 8)}`;
      await seedNote(tenantId, userId, callId, 'Customer asked about billing options');

      const res = await app.inject({
        method: 'POST', url: '/api/v1/supervisor/search',
        headers: { authorization: `Bearer ${token}` },
        payload: { query: 'billing', filter: { artifact_types: ['note'] } },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { results: Array<{ artifact_type: string; call_id: string }> } }>();
      expect(body.data.results).toHaveLength(1);
      expect(body.data.results[0]!.artifact_type).toBe('note');
      expect(body.data.results[0]!.call_id).toBe(callId);
    });

    it('finds dispositions matching the query', async () => {
      const { token, tenantId, userId } = await register(randomUUID().slice(0, 8));
      const callId = `call-${randomUUID().slice(0, 8)}`;
      await seedDisposition(tenantId, callId, userId, 'BILLING_INQUIRY', 'Billing Inquiry');

      const res = await app.inject({
        method: 'POST', url: '/api/v1/supervisor/search',
        headers: { authorization: `Bearer ${token}` },
        payload: { query: 'billing', filter: { artifact_types: ['disposition'] } },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { results: Array<{ artifact_type: string }> } }>();
      expect(body.data.results.length).toBeGreaterThan(0);
      expect(body.data.results[0]!.artifact_type).toBe('disposition');
    });

    it('searches across multiple artifact types', async () => {
      const { token, tenantId, userId } = await register(randomUUID().slice(0, 8));
      const callId1 = `call-${randomUUID().slice(0, 8)}`;
      const callId2 = `call-${randomUUID().slice(0, 8)}`;
      await seedNote(tenantId, userId, callId1, 'Customer refund requested');
      await seedDisposition(tenantId, callId2, userId, 'REFUND', 'Refund Issued');

      const res = await app.inject({
        method: 'POST', url: '/api/v1/supervisor/search',
        headers: { authorization: `Bearer ${token}` },
        payload: { query: 'refund' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { results: Array<{ artifact_type: string }> } }>();
      const types = body.data.results.map((r) => r.artifact_type);
      expect(types).toContain('note');
      expect(types).toContain('disposition');
    });

    it('enforces tenant isolation', async () => {
      const { tenantId: tidA, userId: uidA } = await register(randomUUID().slice(0, 8));
      const { token: tB } = await register(randomUUID().slice(0, 8));
      await seedNote(tidA, uidA, `call-${randomUUID().slice(0, 8)}`, 'billing note for tenant A');

      const res = await app.inject({
        method: 'POST', url: '/api/v1/supervisor/search',
        headers: { authorization: `Bearer ${tB}` },
        payload: { query: 'billing' },
      });
      expect(res.json<{ data: { total: number } }>().data.total).toBe(0);
    });

    it('returns 401 without auth', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/v1/supervisor/search', payload: { query: 'billing' } });
      expect(res.statusCode).toBe(401);
    });

    it('returns 400 for empty query', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'POST', url: '/api/v1/supervisor/search',
        headers: { authorization: `Bearer ${token}` },
        payload: { query: '' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('all results have is_advisory=true', async () => {
      const { token, tenantId, userId } = await register(randomUUID().slice(0, 8));
      await seedNote(tenantId, userId, `call-${randomUUID().slice(0, 8)}`, 'escalation needed');
      const res = await app.inject({
        method: 'POST', url: '/api/v1/supervisor/search',
        headers: { authorization: `Bearer ${token}` },
        payload: { query: 'escalation' },
      });
      const body = res.json<{ data: { results: Array<{ is_advisory: boolean }> } }>();
      expect(body.data.results.every((r) => r.is_advisory === true)).toBe(true);
    });
  });
});
