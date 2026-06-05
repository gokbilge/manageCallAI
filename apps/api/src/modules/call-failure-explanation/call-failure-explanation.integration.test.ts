import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Call Failure Explanation API integration', () => {
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

  async function register(): Promise<{ token: string; tenantId: string }> {
    const s = Math.random().toString(36).slice(2, 10);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: `Tenant ${s}`,
        tenant_slug: `tenant-${s}`,
        email: `user-${s}@example.com`,
        display_name: 'Test User',
        password: 'Secret123!',
      },
    });
    const { token } = res.json<{ token: string }>();
    // Decode JWT payload to get tenant_id (no signature verification needed in tests)
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { tenant_id: string };
    return { token, tenantId: payload.tenant_id };
  }

  it('POST /calls/explain-failure → 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/calls/explain-failure',
      payload: { call_id: 'test-call-1' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /calls/explain-failure → 400 for empty call_id', async () => {
    const { token } = await register();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/calls/explain-failure',
      headers: { authorization: `Bearer ${token}` },
      payload: { call_id: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /calls/explain-failure → 404 when no events exist for call', async () => {
    const { token } = await register();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/calls/explain-failure',
      headers: { authorization: `Bearer ${token}` },
      payload: { call_id: 'no-such-call-id' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /calls/explain-failure → 200 unavailable for non-failed call', async () => {
    const { token, tenantId } = await register();
    const callId = `test-call-${Date.now()}`;

    await db.query(
      `INSERT INTO call_events (tenant_id, call_id, event_type, event_time, source, payload)
       VALUES ($1, $2, 'CHANNEL_ANSWER', NOW(), 'freeswitch', '{}')`,
      [tenantId, callId],
    );
    await db.query(
      `INSERT INTO call_events (tenant_id, call_id, event_type, event_time, source, payload)
       VALUES ($1, $2, 'CHANNEL_HANGUP_COMPLETE', NOW(), 'freeswitch', '{"Hangup-Cause":"NORMAL_CLEARING"}')`,
      [tenantId, callId],
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/calls/explain-failure',
      headers: { authorization: `Bearer ${token}` },
      payload: { call_id: callId },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ data: { status: string; unavailable_reason: string } }>();
    expect(body.data.status).toBe('unavailable');
    expect(body.data.unavailable_reason).toBe('not_failed');
  });

  it('POST /calls/explain-failure → 200 explained for failed call', async () => {
    const { token, tenantId } = await register();
    const callId = `failed-call-${Date.now()}`;

    await db.query(
      `INSERT INTO call_events (tenant_id, call_id, event_type, event_time, source, payload)
       VALUES ($1, $2, 'outbound_call_failed', NOW(), 'go-agent', '{"failure_reason":"NO_ROUTE_FOR_PREFIX"}')`,
      [tenantId, callId],
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/calls/explain-failure',
      headers: { authorization: `Bearer ${token}` },
      payload: { call_id: callId },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      data: {
        status: string;
        is_advisory: boolean;
        likely_cause: string;
        next_action: string;
        observed_facts: unknown[];
        event_timeline: unknown[];
      };
    }>();
    expect(body.data.status).toBe('explained');
    expect(body.data.is_advisory).toBe(true);
    expect(body.data.likely_cause).toBeTruthy();
    expect(body.data.next_action).toBeTruthy();
    expect(body.data.observed_facts.length).toBeGreaterThan(0);
    expect(body.data.event_timeline.length).toBeGreaterThan(0);
  });

  it('POST /calls/explain-failure → tenant isolation: cannot explain another tenant call', async () => {
    const { tenantId: tenantA } = await register();
    const { token: tokenB } = await register();
    const callId = `isolated-call-${Date.now()}`;

    await db.query(
      `INSERT INTO call_events (tenant_id, call_id, event_type, event_time, source, payload)
       VALUES ($1, $2, 'outbound_call_failed', NOW(), 'go-agent', '{"failure_reason":"USER_BUSY"}')`,
      [tenantA, callId],
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/calls/explain-failure',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { call_id: callId },
    });
    expect(res.statusCode).toBe(404);
  });
});
