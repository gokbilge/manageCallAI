import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Voicemail Boxes API integration', () => {
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

  async function createPrompt(token: string, suffix: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/prompts',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: `Greeting ${suffix}`,
        media_type: 'audio/wav',
        storage_uri: `/sounds/test/${suffix}.wav`,
      },
    });
    return res.json<{ data: { id: string } }>().data.id;
  }

  it('POST /voicemail-boxes -> creates box with greeting prompt', async () => {
    const suffix = randomUUID().slice(0, 8);
    const token = await register(suffix);
    const promptId = await createPrompt(token, suffix);

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/voicemail-boxes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'After Hours Mailbox',
        mailbox_number: '8001',
        greeting_prompt_id: promptId,
      },
    });
    expect(create.statusCode).toBe(201);
    const body = create.json<{ data: { mailbox_number: string; greeting_prompt_id: string } }>().data;
    expect(body.mailbox_number).toBe('8001');
    expect(body.greeting_prompt_id).toBe(promptId);
  });

  it('rejects invalid mailbox_number format', async () => {
    const token = await register(randomUUID().slice(0, 8));
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/voicemail-boxes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Bad Mailbox',
        mailbox_number: 'box-a',
      },
    });
    expect(create.statusCode).toBe(400);
  });

  it('tenant isolation: cannot fetch another tenant voicemail box', async () => {
    const token1 = await register(randomUUID().slice(0, 8));
    const token2 = await register(randomUUID().slice(0, 8));
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/voicemail-boxes',
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        name: 'Private Mailbox',
        mailbox_number: '8002',
      },
    });
    const boxId = create.json<{ data: { id: string } }>().data.id;

    const get = await app.inject({
      method: 'GET',
      url: `/api/v1/voicemail-boxes/${boxId}`,
      headers: { authorization: `Bearer ${token2}` },
    });
    expect(get.statusCode).toBe(404);
  });
});
