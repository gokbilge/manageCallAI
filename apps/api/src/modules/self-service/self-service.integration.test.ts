import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Self-service API integration', () => {
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

  async function register(suffix: string): Promise<{ token: string; userId: string; tenantId: string }> {
    const email = `user-${suffix}@example.com`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: `Tenant ${suffix}`,
        tenant_slug: `tenant-${suffix}`,
        email,
        display_name: 'Test User',
        password: 'Secret123!',
      },
    });
    expect(res.statusCode).toBe(201);
    const data = res.json<{ token: string }>();
    const user = await db.query<{ id: string; tenant_id: string }>('SELECT id, tenant_id FROM users WHERE email = $1', [
      email,
    ]);
    expect(user.rowCount).toBe(1);
    return { token: data.token, userId: user.rows[0]!.id, tenantId: user.rows[0]!.tenant_id };
  }

  async function login(tenantSlug: string, email: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { tenant_slug: tenantSlug, email, password: 'Secret123!' },
    });
    expect(res.statusCode).toBe(200);
    return res.json<{ token: string }>().token;
  }

  // ── Self-service policy ────────────────────────────────────────────────────

  it('GET /tenant/self-service-policy -> 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/tenant/self-service-policy' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /tenant/self-service-policy -> returns default policy', async () => {
    const { token } = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/tenant/self-service-policy',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const policy = res.json<{ data: { dnd_manage: boolean; call_forward_manage: boolean } }>().data;
    expect(policy.dnd_manage).toBe(true);
    expect(policy.call_forward_manage).toBe(false);
  });

  it('PUT /tenant/self-service-policy -> updates policy', async () => {
    const { token } = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/tenant/self-service-policy',
      headers: { authorization: `Bearer ${token}` },
      payload: { call_forward_manage: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: { call_forward_manage: boolean } }>().data.call_forward_manage).toBe(true);
  });

  it('PUT then GET returns updated policy', async () => {
    const { token } = await register(randomUUID().slice(0, 8));
    await app.inject({
      method: 'PUT',
      url: '/api/v1/tenant/self-service-policy',
      headers: { authorization: `Bearer ${token}` },
      payload: { dnd_manage: false },
    });
    const get = await app.inject({
      method: 'GET',
      url: '/api/v1/tenant/self-service-policy',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(get.json<{ data: { dnd_manage: boolean } }>().data.dnd_manage).toBe(false);
  });

  it('end_user can use own /me endpoints but cannot use admin extension or policy endpoints', async () => {
    const suffix = randomUUID().slice(0, 8);
    const tenantSlug = `tenant-${suffix}`;
    const { token: adminToken, tenantId } = await register(suffix);
    const endUserEmail = `end-user-${suffix}@example.com`;

    const userRes = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: endUserEmail,
        display_name: 'End User',
        role: 'end_user',
        password: 'Secret123!',
      },
    });
    expect(userRes.statusCode).toBe(201);
    expect(userRes.json<{ data: { role: string } }>().data.role).toBe('end_user');
    const endUserRow = await db.query<{ id: string }>('SELECT id FROM users WHERE tenant_id = $1 AND email = $2', [
      tenantId,
      endUserEmail,
    ]);
    const endUserId = endUserRow.rows[0]!.id;

    const extCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/extensions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { extension_number: '102', display_name: 'End User Desk', sip_password: 'PhonePass123!' },
    });
    expect(extCreate.statusCode).toBe(201);
    const extensionId = extCreate.json<{ data: { id: string } }>().data.id;
    await db.query('UPDATE extensions SET owner_user_id = $1 WHERE id = $2 AND tenant_id = $3', [
      endUserId,
      extensionId,
      tenantId,
    ]);

    const endUserToken = await login(tenantSlug, endUserEmail);
    const ownExtension = await app.inject({
      method: 'GET',
      url: '/api/v1/me/extension',
      headers: { authorization: `Bearer ${endUserToken}` },
    });
    expect(ownExtension.statusCode).toBe(200);
    expect(ownExtension.json<{ data: { id: string; extension_number: string } }>().data).toMatchObject({
      id: extensionId,
      extension_number: '102',
    });

    const adminExtensionList = await app.inject({
      method: 'GET',
      url: '/api/v1/extensions',
      headers: { authorization: `Bearer ${endUserToken}` },
    });
    expect(adminExtensionList.statusCode).toBe(403);

    const policy = await app.inject({
      method: 'GET',
      url: '/api/v1/tenant/self-service-policy',
      headers: { authorization: `Bearer ${endUserToken}` },
    });
    expect(policy.statusCode).toBe(403);
  });

  // ── /me/* — when no extension exists for user ──────────────────────────────

  it('GET /me/extension -> 404 when no extension linked', async () => {
    const { token } = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me/extension',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /me/dnd -> 404 when no extension linked', async () => {
    const { token } = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me/dnd',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('PUT /me/dnd -> 404 when no extension linked', async () => {
    const { token } = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/me/dnd',
      headers: { authorization: `Bearer ${token}` },
      payload: { enabled: true },
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /me/call-forward -> 403 when policy disables it (default off)', async () => {
    const { token } = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me/call-forward',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: string }>().error).toBe('SELF_SERVICE_CAPABILITY_DISABLED');
  });

  it('PUT /me/call-forward -> 403 when policy disables it', async () => {
    const { token } = await register(randomUUID().slice(0, 8));
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/me/call-forward',
      headers: { authorization: `Bearer ${token}` },
      payload: { enabled: true },
    });
    expect(res.statusCode).toBe(403);
  });

  it('/me/* -> 401 without auth', async () => {
    for (const path of ['/api/v1/me/extension', '/api/v1/me/dnd', '/api/v1/me/call-forward']) {
      const res = await app.inject({ method: 'GET', url: path });
      expect(res.statusCode).toBe(401);
    }
  });

  // ── DND with extension wired to user ──────────────────────────────────────

  it('DND and call-forward lifecycle when extension exists', async () => {
    const suffix = randomUUID().slice(0, 8);
    const { token } = await register(suffix);

    // Look up the user ID from the JWT
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/me/extension',
      headers: { authorization: `Bearer ${token}` },
    });
    // Extension doesn't exist yet — 404 expected
    expect(meRes.statusCode).toBe(404);

    // Create an extension — the API must set created_by from the JWT sub
    const extCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/extensions',
      headers: { authorization: `Bearer ${token}` },
      payload: { extension_number: '101', display_name: 'Alice', sip_password: 'PhonePass123!' },
    });
    expect(extCreate.statusCode).toBe(201);

    // Now /me/extension should return the extension
    const meRes2 = await app.inject({
      method: 'GET',
      url: '/api/v1/me/extension',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(meRes2.statusCode).toBe(200);
    expect(meRes2.json<{ data: { extension_number: string } }>().data.extension_number).toBe('101');

    // GET /me/dnd
    const dndGet = await app.inject({
      method: 'GET',
      url: '/api/v1/me/dnd',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(dndGet.statusCode).toBe(200);
    expect(dndGet.json<{ data: { dnd_enabled: boolean } }>().data.dnd_enabled).toBe(false);

    // PUT /me/dnd
    const dndPut = await app.inject({
      method: 'PUT',
      url: '/api/v1/me/dnd',
      headers: { authorization: `Bearer ${token}` },
      payload: { enabled: true },
    });
    expect(dndPut.statusCode).toBe(200);
    expect(dndPut.json<{ data: { dnd_enabled: boolean } }>().data.dnd_enabled).toBe(true);

    // Enable call forward in policy first
    await app.inject({
      method: 'PUT',
      url: '/api/v1/tenant/self-service-policy',
      headers: { authorization: `Bearer ${token}` },
      payload: { call_forward_manage: true, call_forward_set_target: true },
    });

    // PUT /me/call-forward
    const cfPut = await app.inject({
      method: 'PUT',
      url: '/api/v1/me/call-forward',
      headers: { authorization: `Bearer ${token}` },
      payload: { enabled: true, target: '+15555550100' },
    });
    expect(cfPut.statusCode).toBe(200);
    expect(cfPut.json<{ data: { call_forward_enabled: boolean } }>().data.call_forward_enabled).toBe(true);

    // GET /me/call-forward
    const cfGet = await app.inject({
      method: 'GET',
      url: '/api/v1/me/call-forward',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(cfGet.statusCode).toBe(200);
    expect(cfGet.json<{ data: { call_forward_enabled: boolean } }>().data.call_forward_enabled).toBe(true);
  });

  it('lists voicemail, call history, devices, and resets SIP credentials for the owned extension', async () => {
    const suffix = randomUUID().slice(0, 8);
    const tenantSlug = `tenant-${suffix}`;
    const { token: adminToken, tenantId } = await register(suffix);
    const endUserEmail = `portal-${suffix}@example.com`;

    const createUser = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: endUserEmail,
        display_name: 'Portal User',
        role: 'end_user',
        password: 'Secret123!',
      },
    });
    expect(createUser.statusCode).toBe(201);

    const endUserRow = await db.query<{ id: string }>(
      'SELECT id FROM users WHERE tenant_id = $1 AND email = $2',
      [tenantId, endUserEmail],
    );
    const endUserId = endUserRow.rows[0]!.id;

    const extCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/extensions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { extension_number: '220', display_name: 'Portal Desk', sip_password: 'PhonePass123!' },
    });
    expect(extCreate.statusCode).toBe(201);
    const extensionId = extCreate.json<{ data: { id: string } }>().data.id;
    await db.query('UPDATE extensions SET owner_user_id = $1 WHERE id = $2 AND tenant_id = $3', [
      endUserId,
      extensionId,
      tenantId,
    ]);

    const voicemailBox = await db.query<{ id: string }>(
      `INSERT INTO voicemail_boxes (tenant_id, name, mailbox_number)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [tenantId, `Mailbox ${suffix}`, '220'],
    );
    const voicemailBoxId = voicemailBox.rows[0]!.id;

    await db.query(
      `INSERT INTO voicemail_messages (tenant_id, voicemail_box_id, call_id, storage_path, duration_secs, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, voicemailBoxId, 'call-vm-1', 'vm/call-vm-1.wav', 12, 2048],
    );

    await db.query(
      `INSERT INTO call_events (tenant_id, call_id, event_type, event_time, source, payload)
       VALUES ($1, $2, $3, NOW(), $4, $5::jsonb)`,
      [tenantId, 'call-history-1', 'outbound_call_completed', 'freeswitch-agent', JSON.stringify({
        direction: 'outbound',
        from_number: '220',
        to_number: '+14155550100',
      })],
    );

    await db.query(
      `INSERT INTO extension_registrations
         (tenant_id, extension_id, extension_number, status, contact_domain, user_agent, registered_at, last_seen_at)
       VALUES ($1, $2, $3, 'registered', $4, $5, NOW(), NOW())`,
      [tenantId, extensionId, '220', 'pbx.example.com', 'Linphone'],
    );

    const policyUpdate = await app.inject({
      method: 'PUT',
      url: '/api/v1/tenant/self-service-policy',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { sip_credential_reset: true },
    });
    expect(policyUpdate.statusCode).toBe(200);

    const endUserToken = await login(tenantSlug, endUserEmail);

    const voicemail = await app.inject({
      method: 'GET',
      url: '/api/v1/me/voicemail-messages',
      headers: { authorization: `Bearer ${endUserToken}` },
    });
    expect(voicemail.statusCode).toBe(200);
    expect(voicemail.json<{ data: Array<{ call_id: string }> }>().data[0]?.call_id).toBe('call-vm-1');

    const history = await app.inject({
      method: 'GET',
      url: '/api/v1/me/call-history',
      headers: { authorization: `Bearer ${endUserToken}` },
    });
    expect(history.statusCode).toBe(200);
    expect(history.json<{ data: Array<{ call_id: string }> }>().data[0]?.call_id).toBe('call-history-1');

    const devices = await app.inject({
      method: 'GET',
      url: '/api/v1/me/devices',
      headers: { authorization: `Bearer ${endUserToken}` },
    });
    expect(devices.statusCode).toBe(200);
    expect(devices.json<{ data: Array<{ status: string; user_agent: string | null }> }>().data[0]).toMatchObject({
      status: 'registered',
      user_agent: 'Linphone',
    });

    const reset = await app.inject({
      method: 'POST',
      url: '/api/v1/me/sip-credential/reset',
      headers: { authorization: `Bearer ${endUserToken}` },
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json<{ data: { sip_password: string; sip_username: string } }>().data.sip_username).toBe('220');
    expect(reset.json<{ data: { sip_password: string } }>().data.sip_password).toMatch(/^mcai-/);
  });
});
