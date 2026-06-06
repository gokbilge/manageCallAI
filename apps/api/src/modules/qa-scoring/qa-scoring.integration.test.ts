import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('QA scoring workflow (#279)', () => {
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

  async function createTemplate(token: string, name = 'Standard QA') {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/qa-scorecards',
      headers: { authorization: `Bearer ${token}` },
      payload: { name, description: 'Test scorecard' },
    });
    expect(res.statusCode).toBe(201);
    return res.json<{ data: { id: string; name: string } }>().data;
  }

  async function addCriterion(token: string, templateId: string, label: string, maxScore = 10, weight = 1.0) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/qa-scorecards/${templateId}/criteria`,
      headers: { authorization: `Bearer ${token}` },
      payload: { label, max_score: maxScore, weight },
    });
    expect(res.statusCode).toBe(201);
    return res.json<{ data: { id: string } }>().data;
  }

  // ── Templates ──────────────────────────────────────────────────────────────

  describe('POST /api/v1/qa-scorecards', () => {
    it('creates a scorecard template', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const tmpl = await createTemplate(token);
      expect(tmpl.name).toBe('Standard QA');
    });

    it('returns 401 without auth', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/v1/qa-scorecards', payload: { name: 'x' } });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/qa-scorecards', () => {
    it('lists templates for tenant', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      await createTemplate(token, 'Template A');
      await createTemplate(token, 'Template B');
      const res = await app.inject({ method: 'GET', url: '/api/v1/qa-scorecards', headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: unknown[] }>().data.length).toBe(2);
    });

    it('isolates templates by tenant', async () => {
      const { token: tA } = await register(randomUUID().slice(0, 8));
      const { token: tB } = await register(randomUUID().slice(0, 8));
      await createTemplate(tA);
      const res = await app.inject({ method: 'GET', url: '/api/v1/qa-scorecards', headers: { authorization: `Bearer ${tB}` } });
      expect(res.json<{ data: unknown[] }>().data).toHaveLength(0);
    });
  });

  describe('Criteria CRUD', () => {
    it('adds and lists criteria', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const tmpl = await createTemplate(token);
      await addCriterion(token, tmpl.id, 'Greeting', 10);
      await addCriterion(token, tmpl.id, 'Resolution', 10);
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/qa-scorecards/${tmpl.id}/criteria`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: unknown[] }>().data).toHaveLength(2);
    });

    it('deletes a criterion', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const tmpl = await createTemplate(token);
      const crit = await addCriterion(token, tmpl.id, 'To Delete');
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/qa-scorecards/${tmpl.id}/criteria/${crit.id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(delRes.statusCode).toBe(204);
    });
  });

  // ── Full review lifecycle ──────────────────────────────────────────────────

  describe('QA review lifecycle', () => {
    it('draft → submit → finalize', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const tmpl = await createTemplate(token);
      const crit = await addCriterion(token, tmpl.id, 'Greeting', 10, 1.0);
      const callId = `call-${randomUUID().slice(0, 8)}`;

      // create draft review
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/qa-reviews',
        headers: { authorization: `Bearer ${token}` },
        payload: { template_id: tmpl.id, call_id: callId },
      });
      expect(createRes.statusCode).toBe(201);
      const reviewId = createRes.json<{ data: { id: string; status: string } }>().data.id;
      expect(createRes.json<{ data: { status: string } }>().data.status).toBe('draft');

      // submit with scores
      const submitRes = await app.inject({
        method: 'POST',
        url: `/api/v1/qa-reviews/${reviewId}/submit`,
        headers: { authorization: `Bearer ${token}` },
        payload: { scores: [{ criterion_id: crit.id, score: 8, comment: 'Good' }] },
      });
      expect(submitRes.statusCode).toBe(200);
      const submitBody = submitRes.json<{ data: { status: string; overall_score: number; scores: unknown[] } }>();
      expect(submitBody.data.status).toBe('submitted');
      expect(submitBody.data.overall_score).toBeCloseTo(80, 1);
      expect(submitBody.data.scores).toHaveLength(1);

      // finalize
      const finalizeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/qa-reviews/${reviewId}/finalize`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(finalizeRes.statusCode).toBe(200);
      expect(finalizeRes.json<{ data: { status: string } }>().data.status).toBe('finalized');
    });

    it('draft → submit → dispute → finalize', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const tmpl = await createTemplate(token);
      const crit = await addCriterion(token, tmpl.id, 'Greeting', 10, 1.0);
      const callId = `call-${randomUUID().slice(0, 8)}`;

      const createRes = await app.inject({ method: 'POST', url: '/api/v1/qa-reviews', headers: { authorization: `Bearer ${token}` }, payload: { template_id: tmpl.id, call_id: callId } });
      const reviewId = createRes.json<{ data: { id: string } }>().data.id;
      await app.inject({ method: 'POST', url: `/api/v1/qa-reviews/${reviewId}/submit`, headers: { authorization: `Bearer ${token}` }, payload: { scores: [{ criterion_id: crit.id, score: 5 }] } });

      const disputeRes = await app.inject({
        method: 'POST', url: `/api/v1/qa-reviews/${reviewId}/dispute`,
        headers: { authorization: `Bearer ${token}` },
        payload: { dispute_reason: 'Score was too low' },
      });
      expect(disputeRes.statusCode).toBe(200);
      expect(disputeRes.json<{ data: { status: string } }>().data.status).toBe('disputed');

      const finalizeRes = await app.inject({ method: 'POST', url: `/api/v1/qa-reviews/${reviewId}/finalize`, headers: { authorization: `Bearer ${token}` } });
      expect(finalizeRes.statusCode).toBe(200);
      expect(finalizeRes.json<{ data: { status: string } }>().data.status).toBe('finalized');
    });

    it('cannot submit already submitted review', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const tmpl = await createTemplate(token);
      const crit = await addCriterion(token, tmpl.id, 'G', 10, 1.0);
      const callId = `call-${randomUUID().slice(0, 8)}`;
      const createRes = await app.inject({ method: 'POST', url: '/api/v1/qa-reviews', headers: { authorization: `Bearer ${token}` }, payload: { template_id: tmpl.id, call_id: callId } });
      const reviewId = createRes.json<{ data: { id: string } }>().data.id;
      await app.inject({ method: 'POST', url: `/api/v1/qa-reviews/${reviewId}/submit`, headers: { authorization: `Bearer ${token}` }, payload: { scores: [{ criterion_id: crit.id, score: 5 }] } });
      const res2 = await app.inject({ method: 'POST', url: `/api/v1/qa-reviews/${reviewId}/submit`, headers: { authorization: `Bearer ${token}` }, payload: { scores: [{ criterion_id: crit.id, score: 5 }] } });
      expect(res2.statusCode).toBe(400);
    });

    it('returns 404 for non-existent review', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const res = await app.inject({ method: 'GET', url: `/api/v1/qa-reviews/${randomUUID()}`, headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(404);
    });

    it('enforces tenant isolation on reviews', async () => {
      const { token: tA } = await register(randomUUID().slice(0, 8));
      const { token: tB } = await register(randomUUID().slice(0, 8));
      const tmpl = await createTemplate(tA);
      const crit = await addCriterion(tA, tmpl.id, 'G');
      const callId = `call-${randomUUID().slice(0, 8)}`;
      const createRes = await app.inject({ method: 'POST', url: '/api/v1/qa-reviews', headers: { authorization: `Bearer ${tA}` }, payload: { template_id: tmpl.id, call_id: callId } });
      const reviewId = createRes.json<{ data: { id: string } }>().data.id;
      await app.inject({ method: 'POST', url: `/api/v1/qa-reviews/${reviewId}/submit`, headers: { authorization: `Bearer ${tA}` }, payload: { scores: [{ criterion_id: crit.id, score: 5 }] } });

      const res = await app.inject({ method: 'GET', url: `/api/v1/qa-reviews/${reviewId}`, headers: { authorization: `Bearer ${tB}` } });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/qa-reviews', () => {
    it('filters by status', async () => {
      const { token } = await register(randomUUID().slice(0, 8));
      const tmpl = await createTemplate(token);
      const crit = await addCriterion(token, tmpl.id, 'G');
      // create two draft reviews
      for (let i = 0; i < 2; i++) {
        await app.inject({ method: 'POST', url: '/api/v1/qa-reviews', headers: { authorization: `Bearer ${token}` }, payload: { template_id: tmpl.id, call_id: `call-${randomUUID().slice(0, 8)}` } });
      }
      // submit one
      const r = await app.inject({ method: 'POST', url: '/api/v1/qa-reviews', headers: { authorization: `Bearer ${token}` }, payload: { template_id: tmpl.id, call_id: `call-${randomUUID().slice(0, 8)}` } });
      const rid = r.json<{ data: { id: string } }>().data.id;
      await app.inject({ method: 'POST', url: `/api/v1/qa-reviews/${rid}/submit`, headers: { authorization: `Bearer ${token}` }, payload: { scores: [{ criterion_id: crit.id, score: 7 }] } });

      const res = await app.inject({ method: 'GET', url: '/api/v1/qa-reviews?status=draft', headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(200);
      const data = res.json<{ data: Array<{ status: string }> }>();
      expect(data.data.every((r) => r.status === 'draft')).toBe(true);
      expect(data.data.length).toBe(2);
    });
  });
});
