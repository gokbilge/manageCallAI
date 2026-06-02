import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('Integration surface coverage', () => {
  let app: FastifyInstance;
  let db: Pool;

  beforeAll(async () => {
    process.env.RUNTIME_API_TOKEN ??= 'test-runtime-token';
    process.env.JWT_SECRET ??= 'test-jwt-secret';
    process.env.SIP_SECRET_MASTER_KEY ??=
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.SIP_SECRET_KEY_ID ??= 'test-v1';

    const { buildApp } = await import('../app.js');
    ({ db } = await import('../db/client.js'));
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

  async function register(suffix = randomUUID().slice(0, 8)): Promise<{ token: string; tenantId: string }> {
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
    expect(res.statusCode).toBe(201);
    const body = res.json<{ token: string }>();
    const [, payload] = body.token.split('.');
    expect(payload).toBeDefined();
    const claims = JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8')) as {
      tenant_id: string;
    };
    return { token: body.token, tenantId: claims.tenant_id };
  }

  async function createChannelAccount(token: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/channel-accounts',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        provider_type: 'whatsapp',
        name: 'WhatsApp Business',
        capabilities: ['voice_message', 'native_call', 'meeting'],
        provider_config: { phone_number_id: 'wa-1' },
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json<{ data: { id: string } }>().data.id;
  }

  async function createExtension(token: string, extensionNumber = '7001'): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/extensions',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        extension_number: extensionNumber,
        display_name: `Extension ${extensionNumber}`,
        sip_username: `user-${extensionNumber}`,
        sip_password: 'Secret123!',
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json<{ data: { id: string } }>().data.id;
  }

  async function createSipTrunk(token: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sip-trunks',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Coverage carrier',
        direction: 'outbound',
        realm: 'sip.example.test',
        proxy: 'sip.example.test',
        port: 5060,
        transport: 'udp',
        auth_username: 'carrier-user',
        auth_password: 'Secret123!',
        dtmf_mode: 'rfc2833',
        srtp_policy: 'disabled',
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json<{ data: { id: string } }>().data.id;
  }

  it('covers channel account CRUD routes and tenant isolation', async () => {
    const { token } = await register();
    const accountId = await createChannelAccount(token);

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/channel-accounts',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json<{ data: unknown[] }>().data).toHaveLength(1);

    const get = await app.inject({
      method: 'GET',
      url: `/api/v1/channel-accounts/${accountId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(get.statusCode).toBe(200);

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/channel-accounts/${accountId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Updated WhatsApp',
        capabilities: ['voice_message'],
        provider_config: { phone_number_id: 'wa-2' },
      },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json<{ data: { name: string } }>().data.name).toBe('Updated WhatsApp');

    const deactivate = await app.inject({
      method: 'POST',
      url: `/api/v1/channel-accounts/${accountId}/deactivate`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deactivate.statusCode).toBe(200);
    expect(deactivate.json<{ data: { status: string } }>().data.status).toBe('inactive');

    const missing = await app.inject({
      method: 'GET',
      url: `/api/v1/channel-accounts/${randomUUID()}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(missing.statusCode).toBe(404);
  });

  it('covers channel inbound/outbound request lifecycle routes', async () => {
    const { token, tenantId } = await register();
    const accountId = await createChannelAccount(token);

    const inbound = await app.inject({
      method: 'POST',
      url: `/api/v1/channel/accounts/${accountId}/webhook`,
      headers: { authorization: 'Bearer test-runtime-token' },
      payload: {
        tenant_id: tenantId,
        message_type: 'text',
        external_id: 'ext-in-1',
        sender_id: '+15550000001',
        recipient_id: '+15550000002',
        body: 'hello',
        provider_metadata: { provider: 'whatsapp' },
      },
    });
    expect(inbound.statusCode).toBe(201);

    const messages = await app.inject({
      method: 'GET',
      url: `/api/v1/channel/accounts/${accountId}/messages`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(messages.statusCode).toBe(200);
    expect(messages.json<{ data: unknown[] }>().data).toHaveLength(1);

    const outbound = await app.inject({
      method: 'POST',
      url: '/api/v1/channel/messages/outbound',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        channel_account_id: accountId,
        recipient_id: '+15550000003',
        message_type: 'text',
        body: 'outbound hello',
        provider_metadata: { campaign: 'coverage' },
      },
    });
    expect(outbound.statusCode).toBe(201);
    const requestId = outbound.json<{ data: { id: string } }>().data.id;

    const requests = await app.inject({
      method: 'GET',
      url: `/api/v1/channel/accounts/${accountId}/requests`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(requests.statusCode).toBe(200);
    expect(requests.json<{ data: unknown[] }>().data).toHaveLength(1);

    const claim = await app.inject({
      method: 'POST',
      url: '/api/v1/channel/messages/outbound/internal/claim',
      headers: { authorization: 'Bearer test-runtime-token' },
      payload: { tenant_id: tenantId, channel_account_id: accountId, processor_id: 'worker-1' },
    });
    expect(claim.statusCode).toBe(200);
    expect(claim.json<{ data: { id: string } }>().data.id).toBe(requestId);

    const complete = await app.inject({
      method: 'POST',
      url: `/api/v1/channel/messages/outbound/${requestId}/internal/result`,
      headers: { authorization: 'Bearer test-runtime-token' },
      payload: {
        status: 'sent',
        external_id: 'provider-msg-1',
        provider_metadata: { delivered: true },
      },
    });
    expect(complete.statusCode).toBe(200);

    const noClaim = await app.inject({
      method: 'POST',
      url: '/api/v1/channel/messages/outbound/internal/claim',
      headers: { authorization: 'Bearer test-runtime-token' },
      payload: { tenant_id: tenantId, channel_account_id: accountId, processor_id: 'worker-1' },
    });
    expect(noClaim.statusCode).toBe(200);
    expect(noClaim.json<{ data: null }>().data).toBeNull();
  });

  it('covers meeting session create, list, get, and update routes', async () => {
    const { token } = await register();
    const accountId = await createChannelAccount(token);

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/meeting-sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        channel_account_id: accountId,
        meeting_code: 'daily-standup',
        meeting_url: 'https://meet.example.test/daily-standup',
        provider_metadata: { provider: 'google_meet' },
      },
    });
    expect(create.statusCode).toBe(201);
    const sessionId = create.json<{ data: { id: string } }>().data.id;

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/meeting-sessions',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json<{ data: unknown[] }>().data).toHaveLength(1);

    const get = await app.inject({
      method: 'GET',
      url: `/api/v1/meeting-sessions/${sessionId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(get.statusCode).toBe(200);

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/meeting-sessions/${sessionId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        status: 'completed',
        participant_count: 3,
        recording_reference: 'recordings/meeting.wav',
        transcript_reference: 'transcripts/meeting.txt',
        provider_metadata: { ended_by: 'host' },
        started_at: '2026-06-02T20:00:00Z',
        ended_at: '2026-06-02T20:30:00Z',
      },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json<{ data: { status: string; participant_count: number } }>().data).toMatchObject({
      status: 'completed',
      participant_count: 3,
    });
  });

  it('covers export and webhook convenience routes', async () => {
    const { token, tenantId } = await register();

    await db.query(
      `INSERT INTO call_events (tenant_id, call_id, event_type, event_time, source, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, 'call-export-1', 'CHANNEL_CREATE', new Date().toISOString(), 'test', { ok: true }],
    );

    const events = await app.inject({
      method: 'GET',
      url: '/api/v1/export/call-events?limit=10',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(events.statusCode).toBe(200);
    expect(events.json<{ count: number }>().count).toBe(1);

    const sessions = await app.inject({
      method: 'GET',
      url: '/api/v1/export/sessions?limit=not-a-number',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(sessions.statusCode).toBe(200);
    expect(sessions.json<{ count: number }>().count).toBe(0);

    const webhook = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Coverage webhook',
        url: 'https://hooks.example.test/managecallai',
        events: ['call.started'],
      },
    });
    expect(webhook.statusCode).toBe(201);
    const webhookId = webhook.json<{ data: { id: string; signing_secret: string } }>().data.id;

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/webhooks',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json<{ data: unknown[] }>().data).toHaveLength(1);

    const deliveries = await app.inject({
      method: 'GET',
      url: `/api/v1/webhooks/${webhookId}/deliveries`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deliveries.statusCode).toBe(200);

    const queue = await app.inject({
      method: 'GET',
      url: `/api/v1/webhooks/${webhookId}/delivery-queue`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(queue.statusCode).toBe(200);

    const revoke = await app.inject({
      method: 'DELETE',
      url: `/api/v1/webhooks/${webhookId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(revoke.statusCode).toBe(204);
  });

  it('covers metrics and support bundle endpoints', async () => {
    const { token } = await register();

    const metrics = await app.inject({ method: 'GET', url: '/metrics' });
    expect(metrics.statusCode).toBe(200);
    expect(metrics.headers['content-type']).toContain('text/plain');
    expect(metrics.body).toContain('managecallai_active_tenants');

    const support = await app.inject({
      method: 'GET',
      url: '/api/v1/support/bundle?call_limit=5',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(support.statusCode).toBe(200);
    const body = support.json<{ tenant_id: string; webhook_queue: Record<string, number> }>();
    expect(body.tenant_id).toBeTruthy();
    expect(body.webhook_queue).toEqual({});
  });

  it('covers observability snapshots and security alert lifecycle routes', async () => {
    const { token, tenantId } = await register();

    await db.query(
      `INSERT INTO call_events (tenant_id, call_id, event_type, event_time, source, payload)
       VALUES ($1, $2, $3, NOW(), $4, $5)`,
      [tenantId, 'obs-call-1', 'outbound_call_dispatched', 'coverage', { direction: 'outbound' }],
    );

    const snapshot = await app.inject({
      method: 'GET',
      url: '/api/v1/observability/snapshot',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(snapshot.statusCode).toBe(200);

    const createRule = await app.inject({
      method: 'POST',
      url: '/api/v1/observability/security/alert-rules',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Outbound burst',
        description: 'Coverage rule',
        alert_type: 'outbound_call_burst',
        conditions: { threshold: 1, window_minutes: 60 },
        severity: 'warning',
        status: 'active',
      },
    });
    expect(createRule.statusCode).toBe(201);
    const ruleId = createRule.json<{ data: { id: string } }>().data.id;

    const rules = await app.inject({
      method: 'GET',
      url: '/api/v1/observability/security/alert-rules?alert_type=outbound_call_burst&status=active',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(rules.statusCode).toBe(200);

    const patchRule = await app.inject({
      method: 'PATCH',
      url: `/api/v1/observability/security/alert-rules/${ruleId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { severity: 'critical', conditions: { threshold: 1, window_minutes: 120 } },
    });
    expect(patchRule.statusCode).toBe(200);

    const evaluate = await app.inject({
      method: 'POST',
      url: '/api/v1/observability/security/alerts/evaluate',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(evaluate.statusCode).toBe(200);
    const alerts = evaluate.json<{ data: Array<{ id: string }> }>().data;
    expect(alerts.length).toBeGreaterThan(0);
    const alertId = alerts[0]!.id;

    const listAlerts = await app.inject({
      method: 'GET',
      url: '/api/v1/observability/security/alerts?status=new&severity=critical&limit=10',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listAlerts.statusCode).toBe(200);

    for (const action of ['acknowledge', 'resolve']) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/observability/security/alerts/${alertId}/${action}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
    }

    const dismissResolved = await app.inject({
      method: 'POST',
      url: `/api/v1/observability/security/alerts/${alertId}/dismiss`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(dismissResolved.statusCode).toBe(404);

    const deleteRule = await app.inject({
      method: 'DELETE',
      url: `/api/v1/observability/security/alert-rules/${ruleId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deleteRule.statusCode).toBe(204);
  });

  it('covers recording ingest, analysis, retention, and legal hold routes', async () => {
    const { token, tenantId } = await register();

    const ingest = await app.inject({
      method: 'POST',
      url: '/api/v1/recordings/internal/ingest',
      headers: { authorization: 'Bearer test-runtime-token' },
      payload: {
        tenant_id: tenantId,
        call_id: 'rec-call-1',
        storage_path: 'tenant/recordings/rec-call-1.wav',
        duration_secs: 12,
        size_bytes: 4096,
        recorded_at: new Date().toISOString(),
      },
    });
    expect(ingest.statusCode).toBe(201);
    const recordingId = ingest.json<{ data: { id: string } }>().data.id;

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/recordings?call_id=rec-call-1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);

    const get = await app.inject({
      method: 'GET',
      url: `/api/v1/recordings/${recordingId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(get.statusCode).toBe(200);

    const playback = await app.inject({
      method: 'GET',
      url: `/api/v1/recordings/${recordingId}/playback`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(playback.statusCode).toBe(404);

    const analysis = await app.inject({
      method: 'POST',
      url: `/api/v1/recordings/${recordingId}/analysis-requests`,
      headers: { authorization: `Bearer ${token}` },
      payload: { requested_outputs: ['transcript', 'summary'], language_hint: 'en', metadata: { source: 'coverage' } },
    });
    expect(analysis.statusCode).toBe(201);
    const requestId = analysis.json<{ data: { id: string } }>().data.id;

    const claim = await app.inject({
      method: 'POST',
      url: `/api/v1/recording-analysis/internal/${requestId}/claim`,
      headers: { authorization: 'Bearer test-runtime-token' },
      payload: { processor_id: 'analysis-worker-1' },
    });
    expect(claim.statusCode).toBe(200);

    const result = await app.inject({
      method: 'POST',
      url: `/api/v1/recording-analysis/internal/${requestId}/result`,
      headers: { authorization: 'Bearer test-runtime-token' },
      payload: {
        status: 'completed',
        language: 'en',
        transcript_text: 'hello',
        summary_text: 'short call',
        provider_metadata: { model: 'coverage' },
      },
    });
    expect(result.statusCode).toBe(200);

    const requests = await app.inject({
      method: 'GET',
      url: `/api/v1/recordings/${recordingId}/analysis-requests`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(requests.statusCode).toBe(200);

    const policy = await app.inject({
      method: 'PUT',
      url: '/api/v1/recordings/retention-policy',
      headers: { authorization: `Bearer ${token}` },
      payload: { recording_retention_days: 30, call_event_retention_days: 90 },
    });
    expect(policy.statusCode).toBe(200);

    const hold = await app.inject({
      method: 'POST',
      url: '/api/v1/recordings/legal-holds',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        resource_type: 'recording',
        resource_id: recordingId,
        case_reference: 'CASE-1',
        reason: 'coverage hold',
      },
    });
    expect(hold.statusCode).toBe(201);
    const holdId = hold.json<{ data: { id: string } }>().data.id;

    const release = await app.inject({
      method: 'POST',
      url: `/api/v1/recordings/legal-holds/${holdId}/release`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(release.statusCode).toBe(200);
  });

  it('covers outbound routes, call groups, prompt assets, and provider work routes', async () => {
    const { token, tenantId } = await register();
    const extensionId = await createExtension(token, '7010');
    const trunkId = await createSipTrunk(token);

    const callGroup = await app.inject({
      method: 'POST',
      url: '/api/v1/call-groups',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Coverage group', description: 'ring group', strategy: 'sequential' },
    });
    expect(callGroup.statusCode).toBe(201);
    const groupId = callGroup.json<{ data: { id: string } }>().data.id;

    const addMember = await app.inject({
      method: 'POST',
      url: `/api/v1/call-groups/${groupId}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: { extension_id: extensionId, position: 1 },
    });
    expect(addMember.statusCode).toBe(201);

    const getGroup = await app.inject({
      method: 'GET',
      url: `/api/v1/call-groups/${groupId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getGroup.statusCode).toBe(200);

    const prompt = await app.inject({
      method: 'POST',
      url: '/api/v1/prompts',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Greeting',
        media_type: 'audio/wav',
        language: 'en',
        storage_uri: 'prompts/greeting.wav',
        checksum: 'sha256:test',
      },
    });
    expect(prompt.statusCode).toBe(201);
    const promptId = prompt.json<{ data: { id: string } }>().data.id;

    const updatePrompt = await app.inject({
      method: 'PATCH',
      url: `/api/v1/prompts/${promptId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Greeting updated', status: 'inactive' },
    });
    expect(updatePrompt.statusCode).toBe(200);

    const outbound = await app.inject({
      method: 'POST',
      url: '/api/v1/outbound-routes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'North America',
        match_prefix: '+1',
        priority: 10,
        sip_trunk_id: trunkId,
        max_calls_per_minute: 30,
        allowed_destination_prefixes_json: ['+1'],
        blocked_destination_prefixes_json: ['+1900'],
      },
    });
    expect(outbound.statusCode).toBe(201);
    const routeId = outbound.json<{ data: { id: string } }>().data.id;

    const resolve = await app.inject({
      method: 'POST',
      url: '/api/v1/outbound-routes/resolve',
      headers: { authorization: 'Bearer test-runtime-token' },
      payload: { tenant_id: tenantId, dial_number: '+15551234567' },
    });
    expect(resolve.statusCode).toBe(200);

    const deactivate = await app.inject({
      method: 'POST',
      url: `/api/v1/outbound-routes/${routeId}/deactivate`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deactivate.statusCode).toBe(200);

    const promptRequest = await app.inject({
      method: 'POST',
      url: '/api/v1/prompt-generation/requests',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        prompt_asset_id: promptId,
        requested_outputs: ['audio'],
        input_text: 'Say hello',
        language_hint: 'en',
        provider_hint: 'external',
        metadata: { source: 'coverage' },
      },
    });
    expect(promptRequest.statusCode).toBe(201);
    const promptRequestId = promptRequest.json<{ data: { id: string } }>().data.id;

    const claimPrompt = await app.inject({
      method: 'POST',
      url: `/api/v1/prompt-generation/internal/${promptRequestId}/claim`,
      headers: { authorization: 'Bearer test-runtime-token' },
      payload: { processor_id: 'prompt-worker-1' },
    });
    expect(claimPrompt.statusCode).toBe(200);

    const completePrompt = await app.inject({
      method: 'POST',
      url: `/api/v1/prompt-generation/internal/${promptRequestId}/result`,
      headers: { authorization: 'Bearer test-runtime-token' },
      payload: {
        status: 'completed',
        generated_prompt_asset_id: promptId,
        media_reference: 'prompts/generated.wav',
        provider_metadata: { model: 'coverage' },
      },
    });
    expect(completePrompt.statusCode).toBe(200);

    const ivrTurn = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/ivr-ai/turns',
      headers: { authorization: 'Bearer test-runtime-token' },
      payload: {
        tenant_id: tenantId,
        call_id: 'ai-call-1',
        node_id: 'menu',
        input_mode: 'text',
        input_text: 'sales',
        requested_outputs: ['next_action'],
        provider_hint: 'external',
      },
    });
    expect(ivrTurn.statusCode).toBe(201);
    const ivrTurnId = ivrTurn.json<{ data: { id: string } }>().data.id;

    const claimTurn = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-ai/internal/${ivrTurnId}/claim`,
      headers: { authorization: 'Bearer test-runtime-token' },
      payload: { processor_id: 'ivr-worker-1' },
    });
    expect(claimTurn.statusCode).toBe(200);

    const completeTurn = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-ai/internal/${ivrTurnId}/result`,
      headers: { authorization: 'Bearer test-runtime-token' },
      payload: {
        status: 'completed',
        answer_text: 'Routing to sales',
        next_action: { type: 'transfer', destination: '7010' },
        confidence: 0.9,
        provider_metadata: { model: 'coverage' },
      },
    });
    expect(completeTurn.statusCode).toBe(200);
  });
});
