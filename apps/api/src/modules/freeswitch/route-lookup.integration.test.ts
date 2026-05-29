import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Route Lookup API integration', () => {
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
  }, 30000);

  afterAll(async () => {
    await app.close();
    await db.end();
  });

  beforeEach(async () => {
    await db.query('TRUNCATE TABLE tenants CASCADE');
  });

  async function register(suffix: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: `Tenant ${suffix}`,
        tenant_slug: `tenant-${suffix}`,
        email: `user-${suffix}@example.com`,
        display_name: 'Test User',
        password: 'Secret123!',
      },
    });
    return res.json<{ token: string }>().token;
  }

  async function createExtension(token: string, extensionNumber: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/extensions',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        extension_number: extensionNumber,
        display_name: `Ext ${extensionNumber}`,
        sip_password: 'SuperSecret1!',
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json<{ data: { id: string } }>().data.id;
  }

  async function createActiveRoute(
    token: string,
    name: string,
    matchType: string,
    matchValue: string,
    targetType: string,
    targetId: string,
    phoneNumberId?: string,
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      name,
      match_type: matchType,
      match_value: matchValue,
      target_type: targetType,
      target_id: targetId,
    };
    if (phoneNumberId) payload['phone_number_id'] = phoneNumberId;

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/inbound-routes',
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    expect(createRes.statusCode).toBe(201);
    const route = createRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
    const vid = route.versions[0]!.id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/inbound-routes/${route.id}/versions/${vid}/validate`,
      headers: { authorization: `Bearer ${token}` },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/inbound-routes/${route.id}/versions/${vid}/publish`,
      headers: { authorization: `Bearer ${token}` },
    });

    return route.id;
  }

  async function createPhoneNumber(token: string, e164Number: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/phone-numbers',
      headers: { authorization: `Bearer ${token}` },
      payload: { e164_number: e164Number },
    });
    expect(res.statusCode).toBe(201);
    return res.json<{ data: { id: string } }>().data.id;
  }

  it('GET /freeswitch/route-lookup → 401 without runtime token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/freeswitch/route-lookup?did=%2B15551234567',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /freeswitch/route-lookup → 400 when did param is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/freeswitch/route-lookup',
      headers: { 'x-managecallai-runtime-token': 'test-runtime-token' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns matched:false for unknown DID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/freeswitch/route-lookup?did=%2B19990000000',
      headers: { 'x-managecallai-runtime-token': 'test-runtime-token' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ matched: boolean }>().matched).toBe(false);
  });

  it('returns matched:false for a draft (unpublished) route', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const extId = await createExtension(token, '2001');
    await app.inject({
      method: 'POST',
      url: '/api/v1/inbound-routes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Draft Route',
        match_type: 'did',
        match_value: '+15550001111',
        target_type: 'extension',
        target_id: extId,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/freeswitch/route-lookup?did=%2B15550001111',
      headers: { 'x-managecallai-runtime-token': 'test-runtime-token' },
    });
    expect(res.json<{ matched: boolean }>().matched).toBe(false);
  });

  it('resolves active DID route to extension target', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const extId = await createExtension(token, '1001');
    await createActiveRoute(token, 'Main DID', 'did', '+15551234567', 'extension', extId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/freeswitch/route-lookup?did=%2B15551234567',
      headers: { 'x-managecallai-runtime-token': 'test-runtime-token' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      matched: boolean;
      target_type: string;
      target: { extension_number: string; sip_username: string };
    }>();
    expect(body.matched).toBe(true);
    expect(body.target_type).toBe('extension');
    expect(body.target.extension_number).toBe('1001');
    expect(body.target.sip_username).toBe('1001');
  });

  it('resolves DID route bound via phone_number_id (phone_number_id match takes priority)', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const extId = await createExtension(token, '2002');
    const phoneId = await createPhoneNumber(token, '+15559876543');
    await createActiveRoute(token, 'Bound DID', 'did', 'placeholder', 'extension', extId, phoneId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/freeswitch/route-lookup?did=%2B15559876543',
      headers: { 'x-managecallai-runtime-token': 'test-runtime-token' },
    });
    const body = res.json<{ matched: boolean; target_type: string }>();
    expect(body.matched).toBe(true);
    expect(body.target_type).toBe('extension');
  });

  it('resolves pattern match route', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const extId = await createExtension(token, '3001');
    // Pattern: any DID starting with +1800
    await createActiveRoute(token, 'Toll Free', 'pattern', '^\\+1800', 'extension', extId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/freeswitch/route-lookup?did=%2B18001234567',
      headers: { 'x-managecallai-runtime-token': 'test-runtime-token' },
    });
    const body = res.json<{ matched: boolean; target_type: string }>();
    expect(body.matched).toBe(true);
    expect(body.target_type).toBe('extension');
  });

  it('resolves trunk match route', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const extId = await createExtension(token, '4001');
    await createActiveRoute(token, 'Carrier Trunk', 'trunk', 'carrier-a', 'extension', extId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/freeswitch/route-lookup?did=%2B15550000000&trunk=carrier-a',
      headers: { 'x-managecallai-runtime-token': 'test-runtime-token' },
    });
    const body = res.json<{ matched: boolean; target_type: string }>();
    expect(body.matched).toBe(true);
    expect(body.target_type).toBe('extension');
  });

  it('resolves active flow route and returns flow target', async () => {
    const token = await register(randomUUID().slice(0, 8));

    // Create and publish an IVR flow
    const validDef = { nodes: [{ id: 'start', type: 'hangup' }], entry_node_id: 'start' };
    const flowRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Welcome Flow', definition: validDef },
    });
    const flow = flowRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
    const fvid = flow.versions[0]!.id;
    await app.inject({ method: 'POST', url: `/api/v1/ivr-flows/${flow.id}/versions/${fvid}/validate`, headers: { authorization: `Bearer ${token}` } });
    await app.inject({ method: 'POST', url: `/api/v1/ivr-flows/${flow.id}/versions/${fvid}/publish`, headers: { authorization: `Bearer ${token}` } });

    await createActiveRoute(token, 'IVR Route', 'did', '+15558880001', 'flow', flow.id);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/freeswitch/route-lookup?did=%2B15558880001',
      headers: { 'x-managecallai-runtime-token': 'test-runtime-token' },
    });
    const body = res.json<{ matched: boolean; target_type: string; target: { name: string } }>();
    expect(body.matched).toBe(true);
    expect(body.target_type).toBe('flow');
    expect(body.target.name).toBe('Welcome Flow');
  });

  it('GET /freeswitch/dialplan → 401 without runtime token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/freeswitch/dialplan?Caller-Destination-Number=%2B15550000001&domain=tenant-demo.managecallai.local',
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns empty dialplan XML when the tenant domain is unknown', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/freeswitch/dialplan?Caller-Destination-Number=%2B15550000001&domain=missing.managecallai.local',
      headers: { 'x-managecallai-runtime-token': 'test-runtime-token' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<section name="dialplan">');
    expect(res.body).toContain('<context name="default" />');
  });

  it('returns dialplan XML for an active DID route to an extension target', async () => {
    const suffix = randomUUID().slice(0, 8);
    const token = await register(suffix);
    const extId = await createExtension(token, '5001');
    await createActiveRoute(token, 'Inbound Main', 'did', '+15554440001', 'extension', extId);

    const domain = `tenant-${suffix}.managecallai.local`;
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/freeswitch/dialplan?Caller-Destination-Number=%2B15554440001&domain=${domain}`,
      headers: { 'x-managecallai-runtime-token': 'test-runtime-token' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<section name="dialplan">');
    expect(res.body).toContain('application="bridge"');
    expect(res.body).toContain('sofia/internal/5001@tenant-');
    expect(res.body).toContain('.managecallai.local');
    expect(res.body).toContain('managecall_route_id=');
  });

  it('returns dialplan XML with luarun for a DID route targeting a published IVR flow', async () => {
    const suffix = randomUUID().slice(0, 8);
    const token = await register(suffix);

    const validDef = { nodes: [{ id: 'start', type: 'hangup' }], entry_node_id: 'start' };
    const flowRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Welcome IVR', definition: validDef },
    });
    const flow = flowRes.json<{ data: { id: string; versions: Array<{ id: string }> } }>().data;
    const fvid = flow.versions[0]!.id;
    await app.inject({ method: 'POST', url: `/api/v1/ivr-flows/${flow.id}/versions/${fvid}/validate`, headers: { authorization: `Bearer ${token}` } });
    const pubRes = await app.inject({ method: 'POST', url: `/api/v1/ivr-flows/${flow.id}/versions/${fvid}/publish`, headers: { authorization: `Bearer ${token}` } });
    expect(pubRes.json<{ data: { status: string } }>().data.status).toBe('published');

    await createActiveRoute(token, 'IVR Dialplan Route', 'did', '+15556660001', 'flow', flow.id);

    const domain = `tenant-${suffix}.managecallai.local`;
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/freeswitch/dialplan?Caller-Destination-Number=%2B15556660001&domain=${encodeURIComponent(domain)}`,
      headers: { 'x-managecallai-runtime-token': 'test-runtime-token' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<section name="dialplan">');
    expect(res.body).toContain('application="luarun"');
    expect(res.body).toContain('data="managecall_entry.lua"');
    expect(res.body).toContain(`managecall_flow_id=${flow.id}`);
    expect(res.body).toContain('managecall_route_id=');
    expect(res.body).toContain('managecall_tenant_id=');
    expect(res.body).not.toContain('application="bridge"');
  });

  it('returns dialplan XML with bridge string for a DID route targeting a call group', async () => {
    const suffix = randomUUID().slice(0, 8);
    const token = await register(suffix);

    const extId = await createExtension(token, '6001');

    const groupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/call-groups',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Support Team', strategy: 'simultaneous' },
    });
    expect(groupRes.statusCode).toBe(201);
    const groupId = groupRes.json<{ data: { id: string } }>().data.id;

    const memberRes = await app.inject({
      method: 'POST',
      url: `/api/v1/call-groups/${groupId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: { extension_id: extId },
    });
    expect(memberRes.statusCode).toBe(201);

    await createActiveRoute(token, 'Call Group Route', 'did', '+15556660002', 'call_group', groupId);

    const domain = `tenant-${suffix}.managecallai.local`;
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/freeswitch/dialplan?Caller-Destination-Number=%2B15556660002&domain=${encodeURIComponent(domain)}`,
      headers: { 'x-managecallai-runtime-token': 'test-runtime-token' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<section name="dialplan">');
    expect(res.body).toContain('application="bridge"');
    expect(res.body).toContain('sofia/internal/6001@');
    expect(res.body).toContain(domain);
    expect(res.body).toContain('managecall_route_id=');
    expect(res.body).not.toContain('application="luarun"');
  });

  it('returns dialplan XML with bridge string for a DID route targeting a queue', async () => {
    const suffix = randomUUID().slice(0, 8);
    const token = await register(suffix);
    const extId = await createExtension(token, '6101');

    const queueRes = await app.inject({
      method: 'POST',
      url: '/api/v1/queues',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Support Queue', strategy: 'sequential' },
    });
    expect(queueRes.statusCode).toBe(201);
    const queueId = queueRes.json<{ data: { id: string } }>().data.id;

    const memberRes = await app.inject({
      method: 'POST',
      url: `/api/v1/queues/${queueId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: { extension_id: extId },
    });
    expect(memberRes.statusCode).toBe(201);

    await createActiveRoute(token, 'Queue Route', 'did', '+15556660003', 'queue', queueId);

    const domain = `tenant-${suffix}.managecallai.local`;
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/freeswitch/dialplan?Caller-Destination-Number=%2B15556660003&domain=${encodeURIComponent(domain)}`,
      headers: { 'x-managecallai-runtime-token': 'test-runtime-token' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('application="bridge"');
    expect(res.body).toContain('sofia/internal/6101@');
  });

  it('returns dialplan XML for a DID route targeting a voicemail box', async () => {
    const suffix = randomUUID().slice(0, 8);
    const token = await register(suffix);
    const promptRes = await app.inject({
      method: 'POST',
      url: '/api/v1/prompts',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'After Hours Greeting',
        media_type: 'audio/wav',
        storage_uri: '/sounds/test/after-hours.wav',
      },
    });
    expect(promptRes.statusCode).toBe(201);
    const promptId = promptRes.json<{ data: { id: string } }>().data.id;

    const vmRes = await app.inject({
      method: 'POST',
      url: '/api/v1/voicemail-boxes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'After Hours',
        mailbox_number: '8003',
        greeting_prompt_id: promptId,
      },
    });
    expect(vmRes.statusCode).toBe(201);
    const boxId = vmRes.json<{ data: { id: string } }>().data.id;

    await createActiveRoute(token, 'Voicemail Route', 'did', '+15556660004', 'voicemail_box', boxId);

    const domain = `tenant-${suffix}.managecallai.local`;
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/freeswitch/dialplan?Caller-Destination-Number=%2B15556660004&domain=${encodeURIComponent(domain)}`,
      headers: { 'x-managecallai-runtime-token': 'test-runtime-token' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('application="voicemail"');
    expect(res.body).toContain('8003');
  });

  it('returns dialplan XML for a DID route bound through phone_number_id', async () => {
    const suffix = randomUUID().slice(0, 8);
    const token = await register(suffix);
    const extId = await createExtension(token, '5002');
    const phoneId = await createPhoneNumber(token, '+15554440002');
    await createActiveRoute(token, 'Bound Inbound Main', 'did', 'placeholder', 'extension', extId, phoneId);

    const domain = `tenant-${suffix}.managecallai.local`;
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/freeswitch/dialplan?runtime_token=test-runtime-token`,
      payload: `Caller-Destination-Number=%2B15554440002&domain=${encodeURIComponent(domain)}`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('sofia/internal/5002@');
    expect(res.body).toContain(domain);
    expect(res.body).toContain('^\\+15554440002$');
  });
});
