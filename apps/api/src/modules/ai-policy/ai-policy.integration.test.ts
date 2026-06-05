import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

const PLATFORM_EMAIL = 'platform-ai@test.com';

describe('AI policy integration', () => {
  let app: FastifyInstance;
  let db: Pool;

  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/managecallai';
    process.env.RUNTIME_API_TOKEN ??= 'test-runtime-token';
    process.env.JWT_SECRET ??= 'test-jwt-secret';
    process.env.SIP_SECRET_MASTER_KEY ??=
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.SIP_SECRET_KEY_ID ??= 'test-v1';
    process.env.PLATFORM_OPERATOR_EMAILS = PLATFORM_EMAIL;

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
    await db.query(`DELETE FROM system_config WHERE key = 'ai_platform_policy'`);
  });

  async function registerUser(slug: string, email: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: `Tenant ${slug}`,
        tenant_slug: slug,
        email,
        display_name: 'Test User',
        password: 'Secret123!',
      },
    });
    return res.json<{ token: string }>().token;
  }

  async function enableProviderBackedAi(platformToken: string, tenantToken: string): Promise<void> {
    const platformRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/platform/ai-policy',
      headers: { authorization: `Bearer ${platformToken}` },
      payload: {
        provider_backed_enabled: true,
        deterministic_fallback_enabled: true,
        autonomous_runtime_mutation_allowed: false,
        human_approval_required_for_live_changes: true,
        feature_policies: {
          prompt_generation: {
            enabled: true,
            allowed_providers: ['openai', 'external'],
            allowed_models: ['gpt-4.1-mini'],
            max_input_characters: 1000,
          },
          ivr_ai_turn: {
            enabled: true,
            allowed_providers: ['openai', 'external'],
            allowed_models: ['gpt-4.1-mini'],
            max_input_characters: 500,
          },
        },
      },
    });
    expect(platformRes.statusCode).toBe(200);

    const tenantRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/tenant/ai-policy',
      headers: { authorization: `Bearer ${tenantToken}` },
      payload: {
        provider_backed_enabled: true,
        feature_overrides: {
          prompt_generation: { enabled: true, preferred_provider: 'openai' },
          ivr_ai_turn: { enabled: true, preferred_provider: 'openai' },
        },
      },
    });
    expect(tenantRes.statusCode).toBe(200);
  }

  it('lets a platform operator manage platform AI policy and a tenant admin read the effective tenant policy', async () => {
    const suffix = randomUUID().slice(0, 8);
    const platformToken = await registerUser(`platform-${suffix}`, PLATFORM_EMAIL);
    const tenantToken = await registerUser(`tenant-${suffix}`, `tenant-${suffix}@example.com`);

    await enableProviderBackedAi(platformToken, tenantToken);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/tenant/ai-policy',
      headers: { authorization: `Bearer ${tenantToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ data: { provider_backed_enabled: boolean; feature_policies: { prompt_generation: { enabled: boolean } } } }>().data)
      .toMatchObject({
        provider_backed_enabled: true,
        feature_policies: {
          prompt_generation: { enabled: true },
        },
      });
  });

  it('rejects explicit provider-backed prompt generation when AI policy is not enabled', async () => {
    const suffix = randomUUID().slice(0, 8);
    const tenantToken = await registerUser(`tenant-deny-${suffix}`, `tenant-deny-${suffix}@example.com`);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/prompt-generation/requests',
      headers: { authorization: `Bearer ${tenantToken}` },
      payload: {
        requested_outputs: ['audio'],
        input_text: 'Welcome to Acme',
        provider_hint: 'openai',
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json<{ error: string; message: string }>().message).toContain('disabled');
  });

  it('creates a provider-backed prompt generation request after platform and tenant policy opt-in', async () => {
    const suffix = randomUUID().slice(0, 8);
    const platformToken = await registerUser(`platform-ok-${suffix}`, PLATFORM_EMAIL);
    const tenantToken = await registerUser(`tenant-ok-${suffix}`, `tenant-ok-${suffix}@example.com`);
    await enableProviderBackedAi(platformToken, tenantToken);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/prompt-generation/requests',
      headers: { authorization: `Bearer ${tenantToken}` },
      payload: {
        requested_outputs: ['audio'],
        input_text: 'Welcome to Acme',
        provider_hint: 'openai',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json<{ data: { provider_hint: string; metadata: { ai_policy: { provider_backed_allowed: boolean } } } }>().data)
      .toMatchObject({
        provider_hint: 'openai',
        metadata: {
          ai_policy: {
            provider_backed_allowed: true,
          },
        },
      });
  });

  it('falls back runtime IVR AI turns to auto when provider-backed policy is disabled', async () => {
    const tenantToken = await registerUser(`runtime-${randomUUID().slice(0, 8)}`, `runtime-${randomUUID().slice(0, 8)}@example.com`);
    const authRes = await app.inject({
      method: 'GET',
      url: '/api/v1/tenant/ai-policy',
      headers: { authorization: `Bearer ${tenantToken}` },
    });
    const tenantId = authRes.json<{ data: { tenant_id: string } }>().data.tenant_id;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/ivr-ai/turns',
      headers: {
        'x-managecallai-runtime-token': process.env.RUNTIME_API_TOKEN ?? 'test-runtime-token',
      },
      payload: {
        tenant_id: tenantId,
        call_id: 'call-1',
        node_id: 'ai-node',
        input_mode: 'text',
        input_text: 'What are your hours?',
        requested_outputs: ['answer_text'],
        provider_hint: 'openai',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json<{ data: { provider_hint: string; metadata: { ai_policy: { effective_provider_hint: string; fallback_reason: string } } } }>().data)
      .toMatchObject({
        provider_hint: 'auto',
        metadata: {
          ai_policy: {
            effective_provider_hint: 'auto',
            fallback_reason: 'tenant_provider_backed_disabled',
          },
        },
      });
  });
});
