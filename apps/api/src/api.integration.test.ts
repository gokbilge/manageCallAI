import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('API integration', () => {
  let app: FastifyInstance;
  let db: Pool;
  let runtimeToken: string;

  beforeAll(async () => {
    process.env.RUNTIME_API_TOKEN ??= 'test-runtime-token';
    process.env.JWT_SECRET ??= 'test-jwt-secret';
    process.env.SIP_SECRET_MASTER_KEY ??=
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.SIP_SECRET_KEY_ID ??= 'test-v1';
    runtimeToken = process.env.RUNTIME_API_TOKEN;

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

  it('register and login issue JWT tokens', async () => {
    const suffix = randomUUID().slice(0, 8);
    const password = 'Secret123!';

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: `Acme ${suffix}`,
        tenant_slug: `acme-${suffix}`,
        email: `alice-${suffix}@example.com`,
        display_name: 'Alice',
        password,
      },
    });

    expect(registerResponse.statusCode).toBe(201);
    expect(registerResponse.json()).toMatchObject({ token: expect.any(String) });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        tenant_slug: `acme-${suffix}`,
        email: `alice-${suffix}@example.com`,
        password,
      },
    });

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.json()).toMatchObject({ token: expect.any(String) });
  });

  it('supports authenticated extension CRUD without exposing sip_password', async () => {
    const suffix = randomUUID().slice(0, 8);
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: `Tenant ${suffix}`,
        tenant_slug: `tenant-${suffix}`,
        email: `owner-${suffix}@example.com`,
        display_name: 'Owner',
        password: 'Secret123!',
      },
    });

    const token = registerResponse.json<{ token: string }>().token;
    const authHeader = { authorization: `Bearer ${token}` };

    const unauthorizedList = await app.inject({
      method: 'GET',
      url: '/api/v1/extensions',
    });
    expect(unauthorizedList.statusCode).toBe(401);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/extensions',
      headers: authHeader,
      payload: {
        extension_number: '200',
        display_name: 'Reception',
        sip_password: 'PhonePass123!',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toMatchObject({
      data: {
        extension_number: '200',
        display_name: 'Reception',
        sip_username: '200',
        status: 'active',
      },
    });
    expect(createResponse.body).not.toContain('PhonePass123!');

    const created = createResponse.json<{ data: { id: string } }>().data;

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/extensions',
      headers: authHeader,
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json<{ data: Array<{ id: string }> }>().data).toHaveLength(1);

    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/extensions/${created.id}`,
      headers: authHeader,
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.body).not.toContain('PhonePass123!');

    const patchResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/extensions/${created.id}`,
      headers: authHeader,
      payload: {
        display_name: 'Front Desk',
        sip_password: 'NewPhonePass123!',
      },
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json()).toMatchObject({
      data: {
        id: created.id,
        display_name: 'Front Desk',
      },
    });
    expect(patchResponse.body).not.toContain('NewPhonePass123!');

    const deactivateResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/extensions/${created.id}/deactivate`,
      headers: authHeader,
    });
    expect(deactivateResponse.statusCode).toBe(200);
    expect(deactivateResponse.json()).toMatchObject({
      data: {
        id: created.id,
        status: 'inactive',
      },
    });
  });

  it('supports authenticated sip trunk CRUD without exposing auth_password', async () => {
    const suffix = randomUUID().slice(0, 8);
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: `Trunk ${suffix}`,
        tenant_slug: `trunk-${suffix}`,
        email: `trunk-${suffix}@example.com`,
        display_name: 'Trunk Owner',
        password: 'Secret123!',
      },
    });

    const token = registerResponse.json<{ token: string }>().token;
    const authHeader = { authorization: `Bearer ${token}` };

    const unauthorizedList = await app.inject({
      method: 'GET',
      url: '/api/v1/sip-trunks',
    });
    expect(unauthorizedList.statusCode).toBe(401);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/sip-trunks',
      headers: authHeader,
      payload: {
        name: 'Primary Carrier',
        direction: 'bidirectional',
        realm: 'sip.example.net',
        proxy: 'sip.example.net',
        port: 5060,
        transport: 'udp',
        username: 'tenant-200',
        auth_username: 'carrier-user',
        auth_password: 'CarrierPass123!',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toMatchObject({
      data: {
        name: 'Primary Carrier',
        direction: 'bidirectional',
        realm: 'sip.example.net',
        proxy: 'sip.example.net',
        port: 5060,
        transport: 'udp',
        username: 'tenant-200',
        auth_username: 'carrier-user',
        status: 'active',
      },
    });
    expect(createResponse.body).not.toContain('CarrierPass123!');
    expect(createResponse.body).not.toContain('ciphertext');

    const created = createResponse.json<{ data: { id: string; tenant_id: string } }>().data;

    const dbSecretRow = await db.query<{
      auth_password_ciphertext: string;
      auth_password_key_id: string;
    }>(
      'SELECT auth_password_ciphertext, auth_password_key_id FROM sip_trunks WHERE id = $1',
      [created.id],
    );
    expect(dbSecretRow.rows[0]?.auth_password_ciphertext).toBeTruthy();
    expect(dbSecretRow.rows[0]?.auth_password_ciphertext).not.toContain('CarrierPass123!');
    expect(dbSecretRow.rows[0]?.auth_password_key_id).toBeTruthy();

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/sip-trunks',
      headers: authHeader,
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json<{ data: Array<{ id: string }> }>().data).toHaveLength(1);
    expect(listResponse.body).not.toContain('CarrierPass123!');

    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/sip-trunks/${created.id}`,
      headers: authHeader,
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.body).not.toContain('CarrierPass123!');

    const patchResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sip-trunks/${created.id}`,
      headers: authHeader,
      payload: {
        proxy: 'backup.example.net',
        auth_password: 'CarrierPass456!',
      },
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json()).toMatchObject({
      data: {
        id: created.id,
        proxy: 'backup.example.net',
      },
    });
    expect(patchResponse.body).not.toContain('CarrierPass456!');

    const otherRegister = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: `Other ${suffix}`,
        tenant_slug: `other-${suffix}`,
        email: `other-${suffix}@example.com`,
        display_name: 'Other Owner',
        password: 'Secret123!',
      },
    });
    const otherToken = otherRegister.json<{ token: string }>().token;
    const otherGet = await app.inject({
      method: 'GET',
      url: `/api/v1/sip-trunks/${created.id}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(otherGet.statusCode).toBe(404);

    const deactivateResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/sip-trunks/${created.id}/deactivate`,
      headers: authHeader,
    });
    expect(deactivateResponse.statusCode).toBe(200);
    expect(deactivateResponse.json()).toMatchObject({
      data: {
        id: created.id,
        status: 'inactive',
      },
    });
  });

  it('enforces runtime token and tenant domain on FreeSWITCH directory lookup', async () => {
    const suffix = randomUUID().slice(0, 8);
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: `Directory ${suffix}`,
        tenant_slug: `directory-${suffix}`,
        email: `directory-${suffix}@example.com`,
        display_name: 'Directory Owner',
        password: 'Secret123!',
      },
    });

    const token = registerResponse.json<{ token: string }>().token;
    const authHeader = { authorization: `Bearer ${token}` };
    const domain = `directory-${suffix}.managecallai.local`;

    await app.inject({
      method: 'POST',
      url: '/api/v1/extensions',
      headers: authHeader,
      payload: {
        extension_number: '300',
        display_name: 'Directory Desk',
        sip_password: 'DirPass123!',
      },
    });

    const noToken = await app.inject({
      method: 'GET',
      url: `/api/v1/freeswitch/directory?user=300&domain=${domain}`,
    });
    expect(noToken.statusCode).toBe(401);

    const wrongToken = await app.inject({
      method: 'GET',
      url: `/api/v1/freeswitch/directory?user=300&domain=${domain}`,
      headers: { authorization: 'Basic ' + Buffer.from('fs:wrong-token').toString('base64') },
    });
    expect(wrongToken.statusCode).toBe(401);

    const wrongDomain = await app.inject({
      method: 'GET',
      url: '/api/v1/freeswitch/directory?user=300&domain=wrong.managecallai.local',
      headers: { authorization: 'Basic ' + Buffer.from(`fs:${runtimeToken}`).toString('base64') },
    });
    expect(wrongDomain.statusCode).toBe(404);
    expect(wrongDomain.body).toContain('<groups />');

    const success = await app.inject({
      method: 'GET',
      url: `/api/v1/freeswitch/directory?user=300&domain=${domain}`,
      headers: { authorization: 'Basic ' + Buffer.from(`fs:${runtimeToken}`).toString('base64') },
    });
    expect(success.statusCode).toBe(200);
    expect(success.body).toContain('DirPass123!');
    expect(success.body).toContain('managecall_extension_id');
  });

  it('enforces auth on call events list and runtime token on internal ingest', async () => {
    const suffix = randomUUID().slice(0, 8);
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: `Events ${suffix}`,
        tenant_slug: `events-${suffix}`,
        email: `events-${suffix}@example.com`,
        display_name: 'Events Owner',
        password: 'Secret123!',
      },
    });

    const token = registerResponse.json<{ token: string }>().token;
    const authHeader = { authorization: `Bearer ${token}` };

    const createdExtension = await app.inject({
      method: 'POST',
      url: '/api/v1/extensions',
      headers: authHeader,
      payload: {
        extension_number: '400',
        display_name: 'Events Desk',
        sip_password: 'EventPass123!',
      },
    });

    const tenantId = createdExtension.json<{ data: { tenant_id: string } }>().data.tenant_id;

    const unauthenticatedList = await app.inject({
      method: 'GET',
      url: '/api/v1/call-events',
    });
    expect(unauthenticatedList.statusCode).toBe(401);

    const wrongRuntimeToken = await app.inject({
      method: 'POST',
      url: '/api/v1/call-events/internal/ingest',
      headers: { authorization: 'Bearer wrong-token' },
      payload: {
        tenant_id: tenantId,
        call_id: 'call-1',
        event_type: 'channel_create',
      },
    });
    expect(wrongRuntimeToken.statusCode).toBe(401);

    const ingest = await app.inject({
      method: 'POST',
      url: '/api/v1/call-events/internal/ingest',
      headers: { authorization: `Bearer ${runtimeToken}`, 'x-tenant-id': tenantId },
      payload: {
        tenant_id: tenantId,
        call_id: 'call-1',
        event_type: 'channel_create',
      },
    });
    expect(ingest.statusCode).toBe(201);

    const mismatchedTenant = await app.inject({
      method: 'POST',
      url: '/api/v1/call-events/internal/ingest',
      headers: { authorization: `Bearer ${runtimeToken}`, 'x-tenant-id': randomUUID() },
      payload: {
        tenant_id: tenantId,
        call_id: 'call-2',
        event_type: 'channel_create',
      },
    });
    expect(mismatchedTenant.statusCode).toBe(400);

    const forbiddenTenant = await app.inject({
      method: 'GET',
      url: `/api/v1/call-events?tenant_id=${randomUUID()}`,
      headers: authHeader,
    });
    expect(forbiddenTenant.statusCode).toBe(403);

    const authorizedList = await app.inject({
      method: 'GET',
      url: `/api/v1/call-events?tenant_id=${tenantId}`,
      headers: authHeader,
    });
    expect(authorizedList.statusCode).toBe(200);
    expect(authorizedList.body).toContain('call-1');
  });
});
