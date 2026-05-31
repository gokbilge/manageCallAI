/**
 * Demo loop E2E — exercises the primary happy path from tenant registration
 * through published IVR flow reachable via the FreeSWITCH dialplan endpoint.
 *
 * This test is deliberately a single "journey" so CI catches regressions
 * across the full resource lifecycle without requiring multiple database
 * fixtures or mocked layers.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('API demo loop E2E', () => {
  let app: FastifyInstance;
  let db: Pool;
  const runtimeToken = 'test-runtime-token';

  beforeAll(async () => {
    process.env.RUNTIME_API_TOKEN = runtimeToken;
    process.env.JWT_SECRET ??= 'test-jwt-secret';
    process.env.SIP_SECRET_MASTER_KEY ??=
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.SIP_SECRET_KEY_ID ??= 'test-v1';
    process.env.PLATFORM_OPERATOR_EMAILS = '';

    const { buildApp } = await import('./app.js');
    ({ db } = await import('./db/client.js'));
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

  it('full tenant lifecycle: register → extension → IVR flow → route → dialplan → call events', async () => {
    const suffix = randomUUID().slice(0, 8);
    const slug = `demo-${suffix}`;
    const email = `demo-${suffix}@example.com`;

    // ── 1. Register tenant ────────────────────────────────────────────────────
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: 'Demo Tenant',
        tenant_slug: slug,
        email,
        display_name: 'Demo Admin',
        password: 'DemoPass123!',
      },
    });
    expect(registerRes.statusCode).toBe(201);
    const { token } = registerRes.json<{ token: string }>();
    const auth = { authorization: `Bearer ${token}` };

    const claims = JSON.parse(
      Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8'),
    ) as { tenant_id: string; sub: string };
    const { tenant_id: tenantId } = claims;

    // ── 2. Create extension ───────────────────────────────────────────────────
    const extRes = await app.inject({
      method: 'POST',
      url: '/api/v1/extensions',
      headers: auth,
      payload: {
        extension_number: '1001',
        display_name: 'Reception',
        sip_password: 'SipPass123!',
      },
    });
    expect(extRes.statusCode).toBe(201);
    const extension = extRes.json<{ data: { id: string; sip_username: string } }>().data;
    expect(extension.sip_username).toBe('1001');
    expect(extRes.body).not.toContain('SipPass123!');

    // ── 3. Create a prompt asset ──────────────────────────────────────────────
    const promptRes = await app.inject({
      method: 'POST',
      url: '/api/v1/prompts',
      headers: auth,
      payload: {
        name: 'Welcome Greeting',
        media_type: 'audio/wav',
        storage_uri: '/sounds/welcome.wav',
      },
    });
    expect(promptRes.statusCode).toBe(201);

    // ── 4. Create IVR flow ────────────────────────────────────────────────────
    const ivrDef = {
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'menu' },
        {
          id: 'menu',
          type: 'play_collect',
          next_node_id: 'route',
          timeout_node_id: 'end',
          invalid_node_id: 'end',
        },
        {
          id: 'route',
          type: 'switch',
          cases: { '1': 'reception' },
          default_node_id: 'end',
        },
        { id: 'reception', type: 'transfer_extension', extension_number: '1001' },
        { id: 'end', type: 'hangup' },
      ],
    };

    const flowRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: auth,
      payload: { name: 'Main Menu IVR', description: 'Primary customer IVR', graph_json: ivrDef },
    });
    expect(flowRes.statusCode).toBe(201);
    const flow = flowRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
    expect(flow.id).toBeTruthy();
    const draftVersionId = flow.versions[0]!.id;

    // ── 5. Validate the draft ─────────────────────────────────────────────────
    const validateRes = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/versions/${draftVersionId}/validate`,
      headers: auth,
    });
    expect(validateRes.statusCode).toBe(200);
    expect(validateRes.json<{ data: { outcome: { status: string } } }>().data.outcome.status).toBe('passed');

    // ── 6. Simulate to verify caller path ─────────────────────────────────────
    const simRes = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/simulate`,
      headers: auth,
      payload: { digits: ['1'] },
    });
    expect(simRes.statusCode).toBe(200);
    const simBody = simRes.json<{
      data: { outcome: { path: string[]; final_action: { type: string; extension_number?: string } } };
    }>();
    expect(simBody.data.outcome.path).toContain('reception');
    expect(simBody.data.outcome.final_action.extension_number).toBe('1001');

    // ── 7. Publish the IVR flow ───────────────────────────────────────────────
    const publishRes = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/versions/${draftVersionId}/publish`,
      headers: auth,
    });
    expect(publishRes.statusCode).toBe(200);
    const published = publishRes.json<{ data: { status: string; flow: { active_version_id: string } } }>().data;
    expect(published.status).toBe('published');
    expect(published.flow.active_version_id).toBe(draftVersionId);

    // ── 8. Create a phone number ──────────────────────────────────────────────
    const phoneRes = await app.inject({
      method: 'POST',
      url: '/api/v1/phone-numbers',
      headers: auth,
      payload: { e164_number: '+12125550001' },
    });
    expect(phoneRes.statusCode).toBe(201);
    const phone = phoneRes.json<{ data: { id: string } }>().data;

    // ── 9. Create an inbound route pointing to the IVR flow ───────────────────
    const routeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/inbound-routes',
      headers: auth,
      payload: {
        name: 'Main DID → IVR',
        match_type: 'did',
        match_value: '+12125550001',
        target_type: 'flow',
        target_id: flow.id,
        phone_number_id: phone.id,
      },
    });
    expect(routeRes.statusCode).toBe(201);
    const route = routeRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
    const routeVid = route.versions[0]!.id;

    // ── 10. Validate and publish the route ────────────────────────────────────
    await app.inject({
      method: 'POST',
      url: `/api/v1/inbound-routes/${route.id}/versions/${routeVid}/validate`,
      headers: auth,
    });
    const routePublishRes = await app.inject({
      method: 'POST',
      url: `/api/v1/inbound-routes/${route.id}/versions/${routeVid}/publish`,
      headers: auth,
    });
    expect(routePublishRes.statusCode).toBe(200);

    // ── 11. FreeSWITCH dialplan: DID → IVR Lua entry ─────────────────────────
    const domain = `${slug}.managecallai.local`;
    const dialplanRes = await app.inject({
      method: 'GET',
      url: `/api/v1/freeswitch/dialplan?Caller-Destination-Number=%2B12125550001&domain=${encodeURIComponent(domain)}`,
      headers: { 'x-managecallai-runtime-token': runtimeToken },
    });
    expect(dialplanRes.statusCode).toBe(200);
    expect(dialplanRes.body).toContain('application="luarun"');
    expect(dialplanRes.body).toContain('managecall_entry.lua');
    expect(dialplanRes.body).toContain(`managecall_flow_id=${flow.id}`);
    expect(dialplanRes.body).toContain('managecall_route_id=');
    expect(dialplanRes.body).toContain('managecall_tenant_id=');
    expect(dialplanRes.body).not.toContain('application="bridge"');

    // ── 12. Route lookup confirms IVR target ──────────────────────────────────
    const lookupRes = await app.inject({
      method: 'GET',
      url: '/api/v1/freeswitch/route-lookup?did=%2B12125550001',
      headers: { 'x-managecallai-runtime-token': runtimeToken },
    });
    expect(lookupRes.statusCode).toBe(200);
    const lookup = lookupRes.json<{ matched: boolean; target_type: string; target: { name: string } }>();
    expect(lookup.matched).toBe(true);
    expect(lookup.target_type).toBe('flow');
    expect(lookup.target.name).toBe('Main Menu IVR');

    // ── 13. Ingest call events via runtime endpoint ───────────────────────────
    const callId = randomUUID();
    const ingestRes = await app.inject({
      method: 'POST',
      url: '/api/v1/call-events/internal/ingest',
      headers: {
        authorization: `Bearer ${runtimeToken}`,
        'x-tenant-id': tenantId,
      },
      payload: {
        tenant_id: tenantId,
        call_id: callId,
        event_type: 'channel_create',
        metadata: { direction: 'inbound', from: '+12125550001' },
      },
    });
    expect(ingestRes.statusCode).toBe(201);

    // ── 14. Tenant user can list call events ──────────────────────────────────
    const eventsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/call-events?tenant_id=${tenantId}`,
      headers: auth,
    });
    expect(eventsRes.statusCode).toBe(200);
    expect(eventsRes.body).toContain(callId);

    // ── 15. Health endpoint remains responsive ────────────────────────────────
    const healthRes = await app.inject({ method: 'GET', url: '/health' });
    expect(healthRes.statusCode).toBe(200);
  });

  it('IVR flow without validation cannot be published', async () => {
    const suffix = randomUUID().slice(0, 8);
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: 'Guard Test',
        tenant_slug: `guard-${suffix}`,
        email: `guard-${suffix}@example.com`,
        display_name: 'Guard Admin',
        password: 'Pass123!',
      },
    });
    const { token } = registerRes.json<{ token: string }>();
    const auth = { authorization: `Bearer ${token}` };

    const flowRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: auth,
      payload: {
        name: 'Unvalidated Flow',
        graph_json: {
          entry_node_id: 's',
          nodes: [{ id: 's', type: 'hangup' }],
        },
      },
    });
    const flow = flowRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;

    const publishRes = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/versions/${flow.versions[0]!.id}/publish`,
      headers: auth,
    });
    expect(publishRes.statusCode).toBe(409);
  });

  it('extension directory lookup returns XML for active extension', async () => {
    const suffix = randomUUID().slice(0, 8);
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: 'Directory Test',
        tenant_slug: `dir-${suffix}`,
        email: `dir-${suffix}@example.com`,
        display_name: 'Dir Admin',
        password: 'Pass123!',
      },
    });
    const { token } = registerRes.json<{ token: string }>();

    await app.inject({
      method: 'POST',
      url: '/api/v1/extensions',
      headers: { authorization: `Bearer ${token}` },
      payload: { extension_number: '5001', display_name: 'Dir Desk', sip_password: 'DirPass123!' },
    });

    const domain = `dir-${suffix}.managecallai.local`;
    const directoryRes = await app.inject({
      method: 'GET',
      url: `/api/v1/freeswitch/directory?user=5001&domain=${domain}`,
      headers: {
        authorization: 'Basic ' + Buffer.from(`fs:${runtimeToken}`).toString('base64'),
      },
    });
    expect(directoryRes.statusCode).toBe(200);
    expect(directoryRes.body).toContain('managecall_extension_id');
    expect(directoryRes.body).toContain('DirPass123!');
    expect(directoryRes.body).not.toContain('sip_password');
  });
});
