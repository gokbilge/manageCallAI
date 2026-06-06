import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('AI recommendations and incident investigation endpoints', () => {
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

  async function register(suf: string): Promise<string> {
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
    return res.json<{ token: string }>().token;
  }

  // ── AI Recommendations (#258) ─────────────────────────────────────────────

  describe('POST /api/v1/ai-recommendations', () => {
    it('creates a fraud policy recommendation', async () => {
      const token = await register(randomUUID().slice(0, 8));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/ai-recommendations',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          target_type: 'fraud_policy',
          intent: 'Limit to 100 calls per hour and block international calls',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ data: Record<string, unknown> }>();
      expect(body.data.target_type).toBe('fraud_policy');
      expect(body.data.status).toBe('pending');
      expect(body.data.recommendation).toBeDefined();
      expect(body.data.risk_level).toBe('medium');
    });

    it('creates an inbound route recommendation', async () => {
      const token = await register(randomUUID().slice(0, 8));

      // Create a route to target
      const routeRes = await app.inject({
        method: 'POST',
        url: '/api/v1/inbound-routes',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'Sales Route',
          match_type: 'pattern',
          match_value: '^\\+1415',
          target_type: 'extension',
        },
      });
      const routeId = routeRes.json<{ data: { id: string } }>().data.id;

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/ai-recommendations',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          target_type: 'inbound_route',
          target_id: routeId,
          intent: 'Route to queue for sales team',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ data: Record<string, unknown> }>();
      expect(body.data.target_type).toBe('inbound_route');
      expect(body.data.target_id).toBe(routeId);
      expect(body.data.recommendation).toBeDefined();
    });

    it('lists recommendations', async () => {
      const token = await register(randomUUID().slice(0, 8));
      await app.inject({
        method: 'POST',
        url: '/api/v1/ai-recommendations',
        headers: { authorization: `Bearer ${token}` },
        payload: { target_type: 'fraud_policy', intent: 'Block premium rate numbers' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/ai-recommendations',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: unknown[] }>();
      expect(body.data.length).toBeGreaterThan(0);
    });

    it('gets a recommendation by id', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ai-recommendations',
        headers: { authorization: `Bearer ${token}` },
        payload: { target_type: 'fraud_policy', intent: 'Limit calls per day' },
      });
      const recId = createRes.json<{ data: { id: string } }>().data.id;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/ai-recommendations/${recId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: { id: string } }>().data.id).toBe(recId);
    });

    it('returns 404 for unknown recommendation', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/ai-recommendations/${randomUUID()}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Accept and reject recommendations', () => {
    it('accepts a fraud policy recommendation and applies changes', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ai-recommendations',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          target_type: 'fraud_policy',
          intent: 'Limit to 200 calls per hour',
        },
      });
      const recId = createRes.json<{ data: { id: string } }>().data.id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/ai-recommendations/${recId}/accept`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { recommendation: { status: string } } }>();
      expect(body.data.recommendation.status).toBe('accepted');
    });

    it('rejects a recommendation', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ai-recommendations',
        headers: { authorization: `Bearer ${token}` },
        payload: { target_type: 'fraud_policy', intent: 'Block all calls' },
      });
      const recId = createRes.json<{ data: { id: string } }>().data.id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/ai-recommendations/${recId}/reject`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: { status: string } }>().data.status).toBe('rejected');
    });

    it('returns 409 when accepting an already-accepted recommendation', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ai-recommendations',
        headers: { authorization: `Bearer ${token}` },
        payload: { target_type: 'fraud_policy', intent: 'Block international' },
      });
      const recId = createRes.json<{ data: { id: string } }>().data.id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/ai-recommendations/${recId}/accept`,
        headers: { authorization: `Bearer ${token}` },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/ai-recommendations/${recId}/accept`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(409);
    });

    it('accepts an inbound route recommendation and creates a draft version', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const routeRes = await app.inject({
        method: 'POST',
        url: '/api/v1/inbound-routes',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Route A', match_type: 'pattern', match_value: '^\\+1', target_type: 'extension' },
      });
      const routeId = routeRes.json<{ data: { id: string } }>().data.id;

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/ai-recommendations',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          target_type: 'inbound_route',
          target_id: routeId,
          intent: 'Route to queue for incoming calls',
        },
      });
      const recId = createRes.json<{ data: { id: string } }>().data.id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/ai-recommendations/${recId}/accept`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { recommendation: { status: string }; draft_version_id?: string } }>();
      expect(body.data.recommendation.status).toBe('accepted');
      expect(body.data.draft_version_id).toBeDefined();
    });
  });

  // ── Incident Investigation (#259) ─────────────────────────────────────────

  describe('POST /api/v1/incidents/investigate', () => {
    it('creates an investigation with advisory answer', async () => {
      const token = await register(randomUUID().slice(0, 8));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/incidents/investigate',
        headers: { authorization: `Bearer ${token}` },
        payload: { question: 'Why are calls failing this morning?' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ data: Record<string, unknown> }>();
      expect(body.data.is_advisory).toBe(true);
      expect(body.data.answer).toBeDefined();
      expect(typeof body.data.answer).toBe('string');
    });

    it('investigates with time range context', async () => {
      const token = await register(randomUUID().slice(0, 8));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/incidents/investigate',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          question: 'Were there any call failures in the last hour?',
          context: {
            time_range: {
              from: '2026-06-06T09:00:00Z',
              to: '2026-06-06T10:00:00Z',
            },
          },
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ data: { is_advisory: boolean; answer: string } }>();
      expect(body.data.is_advisory).toBe(true);
    });

    it('investigates route health', async () => {
      const token = await register(randomUUID().slice(0, 8));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/incidents/investigate',
        headers: { authorization: `Bearer ${token}` },
        payload: { question: 'Are all inbound routes correctly configured?' },
      });

      expect(res.statusCode).toBe(201);
    });

    it('investigates gateway health', async () => {
      const token = await register(randomUUID().slice(0, 8));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/incidents/investigate',
        headers: { authorization: `Bearer ${token}` },
        payload: { question: 'Is the SIP gateway healthy?' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ data: { is_advisory: boolean } }>();
      expect(body.data.is_advisory).toBe(true);
    });

    it('lists past investigations', async () => {
      const token = await register(randomUUID().slice(0, 8));
      await app.inject({
        method: 'POST',
        url: '/api/v1/incidents/investigate',
        headers: { authorization: `Bearer ${token}` },
        payload: { question: 'What happened?' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/incidents/investigate',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: unknown[] }>();
      expect(body.data.length).toBeGreaterThan(0);
    });

    it('gets a specific investigation by id', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/incidents/investigate',
        headers: { authorization: `Bearer ${token}` },
        payload: { question: 'Check carrier status' },
      });
      const invId = createRes.json<{ data: { id: string } }>().data.id;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/incidents/investigate/${invId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: { id: string } }>().data.id).toBe(invId);
    });

    it('returns 404 for unknown investigation', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/incidents/investigate/${randomUUID()}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
