import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Recording search endpoints (#256)', () => {
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

  async function register(suf: string): Promise<{ token: string; tenantId: string }> {
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
    const body = res.json<{ token: string; tenant_id?: string }>();
    const payload = JSON.parse(Buffer.from(body.token.split('.')[1]!, 'base64url').toString()) as { tenant_id: string };
    return { token: body.token, tenantId: payload.tenant_id };
  }

  async function seedRecordingWithAnalysis(
    tenantId: string,
    callId: string,
    transcript: string,
    summary: string,
  ): Promise<string> {
    const recResult = await db.query<{ id: string }>(
      `INSERT INTO call_recordings (tenant_id, call_id, storage_path, status, recorded_at)
       VALUES ($1, $2, 'test/path.wav', 'available', NOW())
       RETURNING id`,
      [tenantId, callId],
    );
    const recordingId = recResult.rows[0]!.id;

    await db.query(
      `INSERT INTO recording_analysis_requests
         (tenant_id, recording_id, requested_outputs, status, transcript_text, summary_text, completed_at)
       VALUES ($1, $2, ARRAY['transcript','summary'], 'completed', $3, $4, NOW())`,
      [tenantId, recordingId, transcript, summary],
    );

    return recordingId;
  }

  describe('POST /api/v1/recordings/search', () => {
    it('returns 200 with empty results when no recordings exist', async () => {
      const { token } = await register(randomUUID().slice(0, 8));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/recordings/search',
        headers: { authorization: `Bearer ${token}` },
        payload: { query: 'billing' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { results: unknown[]; total: number; mode: string } }>();
      expect(body.data.results).toHaveLength(0);
      expect(body.data.total).toBe(0);
    });

    it('finds recordings via lexical fallback when transcript contains query', async () => {
      const { token, tenantId } = await register(randomUUID().slice(0, 8));

      await seedRecordingWithAnalysis(
        tenantId,
        `call-${randomUUID().slice(0, 8)}`,
        'The customer asked about billing and refund options.',
        'Billing inquiry.',
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/recordings/search',
        headers: { authorization: `Bearer ${token}` },
        payload: { query: 'billing refund' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { results: Array<{ recording_id: string; match_type: string; is_advisory: boolean }>; mode: string } }>();
      expect(body.data.results.length).toBeGreaterThan(0);
      expect(body.data.results[0]!.is_advisory).toBe(true);
      expect(['transcript', 'summary', 'both']).toContain(body.data.results[0]!.match_type);
    });

    it('returns only results for the authenticated tenant', async () => {
      const { token: tokenA, tenantId: tenantAId } = await register(randomUUID().slice(0, 8));
      const { token: tokenB } = await register(randomUUID().slice(0, 8));

      await seedRecordingWithAnalysis(tenantAId, `call-${randomUUID().slice(0, 8)}`, 'Tenant A billing call.', '');

      const resB = await app.inject({
        method: 'POST',
        url: '/api/v1/recordings/search',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { query: 'billing' },
      });

      expect(resB.statusCode).toBe(200);
      const bodyB = resB.json<{ data: { results: unknown[] } }>();
      expect(bodyB.data.results).toHaveLength(0);

      const resA = await app.inject({
        method: 'POST',
        url: '/api/v1/recordings/search',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { query: 'billing' },
      });
      expect(resA.statusCode).toBe(200);
      const bodyA = resA.json<{ data: { results: unknown[] } }>();
      expect(bodyA.data.results.length).toBeGreaterThan(0);
    });

    it('respects call_id filter', async () => {
      const { token, tenantId } = await register(randomUUID().slice(0, 8));
      const callIdA = `call-${randomUUID().slice(0, 8)}`;
      const callIdB = `call-${randomUUID().slice(0, 8)}`;

      await seedRecordingWithAnalysis(tenantId, callIdA, 'Billing discussion.', '');
      await seedRecordingWithAnalysis(tenantId, callIdB, 'Another billing call.', '');

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/recordings/search',
        headers: { authorization: `Bearer ${token}` },
        payload: { query: 'billing', filter: { call_id: callIdA } },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { results: Array<{ call_id: string }> } }>();
      expect(body.data.results.every((r) => r.call_id === callIdA)).toBe(true);
    });

    it('respects limit parameter', async () => {
      const { token, tenantId } = await register(randomUUID().slice(0, 8));

      for (let i = 0; i < 5; i++) {
        await seedRecordingWithAnalysis(tenantId, `call-${randomUUID().slice(0, 8)}`, `Billing call number ${i}.`, '');
      }

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/recordings/search',
        headers: { authorization: `Bearer ${token}` },
        payload: { query: 'billing', limit: 2 },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { results: unknown[] } }>();
      expect(body.data.results.length).toBeLessThanOrEqual(2);
    });

    it('returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/recordings/search',
        payload: { query: 'billing' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 400 for empty query', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/recordings/search',
        headers: { authorization: `Bearer ${token}` },
        payload: { query: '' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('includes match_context and match_reason in results', async () => {
      const { token, tenantId } = await register(randomUUID().slice(0, 8));

      await seedRecordingWithAnalysis(
        tenantId,
        `call-${randomUUID().slice(0, 8)}`,
        'The customer was upset about the invoice amount and requested a full refund.',
        'Refund requested.',
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/recordings/search',
        headers: { authorization: `Bearer ${token}` },
        payload: { query: 'refund invoice' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { results: Array<{ match_context: string; match_reason: string }> } }>();
      if (body.data.results.length > 0) {
        expect(typeof body.data.results[0]!.match_context).toBe('string');
        expect(typeof body.data.results[0]!.match_reason).toBe('string');
      }
    });
  });
});
