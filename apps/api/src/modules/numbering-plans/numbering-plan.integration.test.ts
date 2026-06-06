import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Numbering plans, calling policies, and sites (#300–#304)', () => {
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

  // ── Numbering plans (#300) ─────────────────────────────────────────────────

  describe('POST /api/v1/numbering-plans', () => {
    it('creates a numbering plan and retrieves it with rules', async () => {
      const token = await register(randomUUID().slice(0, 8));

      const createRes = await app.inject({
        method: 'POST', url: '/api/v1/numbering-plans',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'NANP', country_code: '1' },
      });
      expect(createRes.statusCode).toBe(201);
      const plan = createRes.json<{ data: { id: string; name: string } }>().data;
      expect(plan.name).toBe('NANP');

      // Add a rule
      const ruleRes = await app.inject({
        method: 'POST', url: `/api/v1/numbering-plans/${plan.id}/rules`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'International', pattern: '^\\+(?!1)', call_type: 'international', priority: 10 },
      });
      expect(ruleRes.statusCode).toBe(201);
      expect(ruleRes.json<{ data: { call_type: string } }>().data.call_type).toBe('international');

      // Get with rules
      const getRes = await app.inject({
        method: 'GET', url: `/api/v1/numbering-plans/${plan.id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getRes.statusCode).toBe(200);
      const full = getRes.json<{ data: { rules: unknown[] } }>().data;
      expect(full.rules).toHaveLength(1);
    });

    it('lists numbering plans', async () => {
      const token = await register(randomUUID().slice(0, 8));
      await app.inject({ method: 'POST', url: '/api/v1/numbering-plans', headers: { authorization: `Bearer ${token}` }, payload: { name: 'Test' } });
      const res = await app.inject({ method: 'GET', url: '/api/v1/numbering-plans', headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: unknown[] }>().data.length).toBeGreaterThan(0);
    });

    it('returns 404 for unknown plan', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const res = await app.inject({ method: 'GET', url: `/api/v1/numbering-plans/${randomUUID()}`, headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/numbering-plans/check (#302)', () => {
    it('returns dial check result — no match when no rules', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'POST', url: '/api/v1/numbering-plans/check',
        headers: { authorization: `Bearer ${token}` },
        payload: { dial_string: '+14155551234' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { dial_string: string; call_type: null; is_advisory: boolean } }>();
      expect(body.data.call_type).toBeNull();
      expect(body.data.is_advisory).toBe(true);
    });
  });

  // ── Calling policies (#301) ────────────────────────────────────────────────

  describe('POST /api/v1/calling-policies', () => {
    it('creates, gets, and updates a calling policy', async () => {
      const token = await register(randomUUID().slice(0, 8));

      const createRes = await app.inject({
        method: 'POST', url: '/api/v1/calling-policies',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Domestic Only', allow_international: false, allow_premium_rate: false },
      });
      expect(createRes.statusCode).toBe(201);
      const pol = createRes.json<{ data: { id: string; allow_international: boolean } }>().data;
      expect(pol.allow_international).toBe(false);

      const patchRes = await app.inject({
        method: 'PATCH', url: `/api/v1/calling-policies/${pol.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { allow_toll_free: false },
      });
      expect(patchRes.statusCode).toBe(200);
    });

    it('lists calling policies', async () => {
      const token = await register(randomUUID().slice(0, 8));
      await app.inject({ method: 'POST', url: '/api/v1/calling-policies', headers: { authorization: `Bearer ${token}` }, payload: { name: 'P1' } });
      const res = await app.inject({ method: 'GET', url: '/api/v1/calling-policies', headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: unknown[] }>().data.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/calling-policies/check (#302)', () => {
    it('returns advisory result — all allowed when no policy assigned', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'POST', url: '/api/v1/calling-policies/check',
        headers: { authorization: `Bearer ${token}` },
        payload: { call_type: 'international' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: { allowed: boolean; is_advisory: boolean } }>();
      expect(body.data.allowed).toBe(true);
      expect(body.data.is_advisory).toBe(true);
    });
  });

  // ── Sites and locations (#303, #304) ──────────────────────────────────────

  describe('POST /api/v1/sites', () => {
    it('creates a site with emergency and dialing defaults', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const res = await app.inject({
        method: 'POST', url: '/api/v1/sites',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'HQ', city: 'San Francisco', country_code: 'US',
          timezone: 'America/Los_Angeles', emergency_number: '911',
        },
      });
      expect(res.statusCode).toBe(201);
      const site = res.json<{ data: { id: string; name: string; emergency_number: string } }>().data;
      expect(site.name).toBe('HQ');
      expect(site.emergency_number).toBe('911');
    });

    it('lists sites', async () => {
      const token = await register(randomUUID().slice(0, 8));
      await app.inject({ method: 'POST', url: '/api/v1/sites', headers: { authorization: `Bearer ${token}` }, payload: { name: 'Branch' } });
      const res = await app.inject({ method: 'GET', url: '/api/v1/sites', headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ data: unknown[] }>().data.length).toBeGreaterThan(0);
    });

    it('gets site with locations', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({
        method: 'POST', url: '/api/v1/sites',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Campus' },
      });
      const siteId = createRes.json<{ data: { id: string } }>().data.id;

      // Add location
      const locRes = await app.inject({
        method: 'POST', url: `/api/v1/sites/${siteId}/locations`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Building A', floor: '1' },
      });
      expect(locRes.statusCode).toBe(201);
      expect(locRes.json<{ data: { floor: string } }>().data.floor).toBe('1');

      // Get with locations
      const getRes = await app.inject({ method: 'GET', url: `/api/v1/sites/${siteId}`, headers: { authorization: `Bearer ${token}` } });
      expect(getRes.statusCode).toBe(200);
      const full = getRes.json<{ data: { locations: unknown[] } }>().data;
      expect(full.locations).toHaveLength(1);
    });

    it('returns 404 for unknown site', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const res = await app.inject({ method: 'GET', url: `/api/v1/sites/${randomUUID()}`, headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(404);
    });

    it('enforces tenant isolation', async () => {
      const tokenA = await register(randomUUID().slice(0, 8));
      const tokenB = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({ method: 'POST', url: '/api/v1/sites', headers: { authorization: `Bearer ${tokenA}` }, payload: { name: 'A Site' } });
      const siteId = createRes.json<{ data: { id: string } }>().data.id;

      const res = await app.inject({ method: 'GET', url: `/api/v1/sites/${siteId}`, headers: { authorization: `Bearer ${tokenB}` } });
      expect(res.statusCode).toBe(404);
    });

    it('updates a site and deletes a location', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({ method: 'POST', url: '/api/v1/sites', headers: { authorization: `Bearer ${token}` }, payload: { name: 'Site X' } });
      const siteId = createRes.json<{ data: { id: string } }>().data.id;

      const patchRes = await app.inject({ method: 'PATCH', url: `/api/v1/sites/${siteId}`, headers: { authorization: `Bearer ${token}` }, payload: { timezone: 'Europe/London', emergency_number: '999' } });
      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json<{ data: { emergency_number: string } }>().data.emergency_number).toBe('999');

      const locRes = await app.inject({ method: 'POST', url: `/api/v1/sites/${siteId}/locations`, headers: { authorization: `Bearer ${token}` }, payload: { name: 'West Wing', floor: '2' } });
      const locId = locRes.json<{ data: { id: string } }>().data.id;

      const delLocRes = await app.inject({ method: 'DELETE', url: `/api/v1/sites/${siteId}/locations/${locId}`, headers: { authorization: `Bearer ${token}` } });
      expect(delLocRes.statusCode).toBe(204);
    });
  });

  describe('Calling policy assignment and check (#302)', () => {
    it('assigns policy to tenant and check returns policy-aware result', async () => {
      const token = await register(randomUUID().slice(0, 8));

      const createRes = await app.inject({
        method: 'POST', url: '/api/v1/calling-policies',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'No International', allow_international: false, allow_premium_rate: false },
      });
      const polId = createRes.json<{ data: { id: string } }>().data.id;

      // Assign to tenant scope
      const assignRes = await app.inject({
        method: 'PUT', url: `/api/v1/calling-policies/${polId}/assignment`,
        headers: { authorization: `Bearer ${token}` },
        payload: { assignable_type: 'tenant' },
      });
      expect(assignRes.statusCode).toBe(200);

      // Check — international should now be blocked
      const checkRes = await app.inject({
        method: 'POST', url: '/api/v1/calling-policies/check',
        headers: { authorization: `Bearer ${token}` },
        payload: { call_type: 'international' },
      });
      expect(checkRes.statusCode).toBe(200);
      const body = checkRes.json<{ data: { allowed: boolean; policy_id: string } }>();
      expect(body.data.allowed).toBe(false);
      expect(body.data.policy_id).toBe(polId);
    });

    it('deletes a numbering plan rule and deletes the plan', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const planRes = await app.inject({ method: 'POST', url: '/api/v1/numbering-plans', headers: { authorization: `Bearer ${token}` }, payload: { name: 'Test Plan' } });
      const planId = planRes.json<{ data: { id: string } }>().data.id;

      const ruleRes = await app.inject({ method: 'POST', url: `/api/v1/numbering-plans/${planId}/rules`, headers: { authorization: `Bearer ${token}` }, payload: { name: 'Intl', pattern: '^\\+', call_type: 'international' } });
      const ruleId = ruleRes.json<{ data: { id: string } }>().data.id;

      const delRuleRes = await app.inject({ method: 'DELETE', url: `/api/v1/numbering-plans/${planId}/rules/${ruleId}`, headers: { authorization: `Bearer ${token}` } });
      expect(delRuleRes.statusCode).toBe(204);

      const delPlanRes = await app.inject({ method: 'DELETE', url: `/api/v1/numbering-plans/${planId}`, headers: { authorization: `Bearer ${token}` } });
      expect(delPlanRes.statusCode).toBe(204);
    });

    it('patches a numbering plan name', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const planRes = await app.inject({ method: 'POST', url: '/api/v1/numbering-plans', headers: { authorization: `Bearer ${token}` }, payload: { name: 'Old Name' } });
      const planId = planRes.json<{ data: { id: string } }>().data.id;

      const patchRes = await app.inject({ method: 'PATCH', url: `/api/v1/numbering-plans/${planId}`, headers: { authorization: `Bearer ${token}` }, payload: { name: 'New Name', status: 'inactive' } });
      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json<{ data: { name: string } }>().data.name).toBe('New Name');
    });

    it('deletes a calling policy', async () => {
      const token = await register(randomUUID().slice(0, 8));
      const createRes = await app.inject({ method: 'POST', url: '/api/v1/calling-policies', headers: { authorization: `Bearer ${token}` }, payload: { name: 'To Delete' } });
      const polId = createRes.json<{ data: { id: string } }>().data.id;
      const delRes = await app.inject({ method: 'DELETE', url: `/api/v1/calling-policies/${polId}`, headers: { authorization: `Bearer ${token}` } });
      expect(delRes.statusCode).toBe(204);
    });
  });
});
