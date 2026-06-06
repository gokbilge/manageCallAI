import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Campaigns API integration', () => {
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

  async function register(suffix: string): Promise<{ token: string; userId: string }> {
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
    const { token } = res.json<{ token: string }>();
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { sub: string };
    return { token, userId: payload.sub };
  }

  it('GET /campaigns -> 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/campaigns' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /campaigns -> creates campaign and lifecycle transitions work', async () => {
    const { token } = await register(randomUUID().slice(0, 8));

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/campaigns',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Summer Outreach', campaign_type: 'outbound_preview' },
    });
    expect(create.statusCode).toBe(201);
    const campaign = create.json<{ data: { id: string; status: string } }>().data;
    expect(campaign.status).toBe('draft');

    // Transition draft → active
    const activate = await app.inject({
      method: 'POST',
      url: `/api/v1/campaigns/${campaign.id}/transition`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'active' },
    });
    expect(activate.statusCode).toBe(200);
    expect(activate.json<{ data: { status: string } }>().data.status).toBe('active');

    // Transition active → paused
    const pause = await app.inject({
      method: 'POST',
      url: `/api/v1/campaigns/${campaign.id}/transition`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'paused' },
    });
    expect(pause.statusCode).toBe(200);
  });

  it('POST /campaigns/:id/transition -> rejects invalid transition', async () => {
    const { token } = await register(randomUUID().slice(0, 8));

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/campaigns',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Bad Transition Test' },
    });
    const campaignId = create.json<{ data: { id: string } }>().data.id;

    // draft → paused is invalid
    const bad = await app.inject({
      method: 'POST',
      url: `/api/v1/campaigns/${campaignId}/transition`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'paused' },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('POST /campaigns/:id/contacts -> adds contacts', async () => {
    const { token } = await register(randomUUID().slice(0, 8));

    const createCampaign = await app.inject({
      method: 'POST',
      url: '/api/v1/campaigns',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Contact Test' },
    });
    const campaignId = createCampaign.json<{ data: { id: string } }>().data.id;

    const addContact = await app.inject({
      method: 'POST',
      url: `/api/v1/campaigns/${campaignId}/contacts`,
      headers: { authorization: `Bearer ${token}` },
      payload: { phone_number: '+15551234567', display_name: 'Alice' },
    });
    expect(addContact.statusCode).toBe(201);
    expect(addContact.json<{ data: { phone_number: string } }>().data.phone_number).toBe('+15551234567');

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/campaigns/${campaignId}/contacts`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.json<{ data: unknown[] }>().data).toHaveLength(1);
  });

  it('tenant isolation: cannot see another tenant campaigns', async () => {
    const { token: t1 } = await register(randomUUID().slice(0, 8));
    const { token: t2 } = await register(randomUUID().slice(0, 8));

    await app.inject({
      method: 'POST',
      url: '/api/v1/campaigns',
      headers: { authorization: `Bearer ${t1}` },
      payload: { name: 'T1 Campaign' },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/campaigns',
      headers: { authorization: `Bearer ${t2}` },
    });
    expect(list.json<{ data: unknown[] }>().data).toHaveLength(0);
  });
});
