import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

type QueryResult = { rows: unknown[]; rowCount?: number };

function makePool(results: Array<QueryResult | Error> = []): Pool & { query: ReturnType<typeof vi.fn> } {
  const queue = [...results];
  const query = vi.fn(async () => {
    const next = queue.shift() ?? { rows: [{ id: 'default-id' }] };
    if (next instanceof Error) throw next;
    return next;
  });
  return { query } as unknown as Pool & { query: ReturnType<typeof vi.fn> };
}

const row = (value: Record<string, unknown>): QueryResult => ({ rows: [value] });
const rows = (values: Array<Record<string, unknown>>): QueryResult => ({ rows: values });
const empty = (): QueryResult => ({ rows: [] });

describe('Repository coverage', () => {
  beforeAll(() => {
    process.env.SIP_SECRET_MASTER_KEY ??=
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.SIP_SECRET_KEY_ID ??= 'test-v1';
  });

  it('covers IVR runtime repository query paths and reference maps', async () => {
    const { IvrRuntimeRepository } = await import('./runtime/ivr-runtime.repository.js');
    const session = {
      id: 'session-1',
      tenant_id: 'tenant-1',
      flow_id: 'flow-1',
      flow_version_id: 'version-1',
      call_id: 'call-1',
      status: 'running',
      current_node_id: 'start',
      variables_json: {},
    };
    const pool = makePool([
      row({ tenant_id: 'tenant-1', flow_id: 'flow-1', flow_version_id: 'version-1', graph_json: {} }),
      row(session),
      empty(),
      row(session),
      row({ ...session, status: 'completed' }),
      row({ tenant_id: 'tenant-1', flow_id: 'flow-1', flow_version_id: 'version-1', graph_json: {} }),
      rows([session]),
      row({ id: 'step-1', tenant_id: 'tenant-1', session_id: 'session-1', phase: 'enter', outcome: 'continue' }),
      rows([{ id: 'step-1' }]),
      rows([{ id: 'event-1', call_id: 'call-1', event_type: 'dtmf' }]),
      rows([{ id: 'prompt-1', name: 'Greeting', storage_uri: 'prompt.wav' }]),
      rows([{ id: 'ext-1', extension_number: '1001', display_name: 'Desk', directory_domain: 'pbx.test' }]),
      row({ id: 'schedule-1', timezone: 'UTC', weekly_rules_json: {}, holiday_overrides_json: {} }),
      rows([{ id: 'queue-1', name: 'Sales', strategy: 'sequential', ring_timeout_seconds: 10, retry_delay_seconds: 1, max_wait_seconds: 60, music_on_hold: null, overflow_target_type: null, overflow_target_id: null }]),
      rows([{ queue_id: 'queue-1', extension_number: '1001', directory_domain: 'pbx.test', position: 1 }]),
      rows([{ id: 'vm-1', name: 'Mailbox', mailbox_number: '9001', directory_domain: 'pbx.test', greeting_prompt_uri: 'greeting.wav' }]),
    ]);
    const repo = new IvrRuntimeRepository(pool);

    await expect(repo.findActiveFlowVersion('flow-1')).resolves.toMatchObject({ flow_id: 'flow-1' });
    await expect(repo.createSession({
      tenant_id: 'tenant-1',
      flow_id: 'flow-1',
      flow_version_id: 'version-1',
      call_id: 'call-1',
      variables_json: { caller: '1001' },
      last_action_json: { type: 'play' },
    })).resolves.toMatchObject({ id: 'session-1' });
    await expect(repo.findSessionById('missing')).resolves.toBeNull();
    await expect(repo.findSessionByIdForTenant('session-1', 'tenant-1')).resolves.toMatchObject({ id: 'session-1' });
    await expect(repo.updateSessionState({
      id: 'session-1',
      status: 'completed',
      current_node_id: null,
      last_digits: null,
      variables_json: {},
      last_action_json: null,
      completed_at: new Date(),
    })).resolves.toMatchObject({ status: 'completed' });
    await expect(repo.getFlowGraphForSession('session-1')).resolves.toMatchObject({ flow_id: 'flow-1' });
    await expect(repo.listSessionsByTenant('tenant-1', 'running')).resolves.toHaveLength(1);
    await expect(repo.recordSessionStep({
      tenant_id: 'tenant-1',
      session_id: 'session-1',
      phase: 'advance',
      node_id: 'start',
      outcome: 'digits',
      digits: '1',
      action_json: { type: 'menu' },
      resulting_node_id: 'next',
      resulting_status: 'running',
      variables_json: {},
    })).resolves.toMatchObject({ id: 'step-1' });
    await expect(repo.listSessionSteps('session-1', 'tenant-1')).resolves.toHaveLength(1);
    await expect(repo.listCallEventsByCallId('call-1', 'tenant-1')).resolves.toHaveLength(1);
    expect(await repo.findActivePromptRefs('tenant-1', [])).toEqual(new Map());
    expect(await repo.findActiveExtensionTargets('tenant-1', [])).toEqual(new Map());
    expect(await repo.findActiveQueueTargets('tenant-1', [])).toEqual(new Map());
    expect(await repo.findActiveVoicemailTargets('tenant-1', [])).toEqual(new Map());
    expect(await repo.findActivePromptRefs('tenant-1', ['prompt-1'])).toHaveProperty('size', 1);
    expect(await repo.findActiveExtensionTargets('tenant-1', ['ext-1'])).toHaveProperty('size', 1);
    await expect(repo.findActiveSchedule('tenant-1', 'schedule-1')).resolves.toMatchObject({ id: 'schedule-1' });
    expect(await repo.findActiveQueueTargets('tenant-1', ['queue-1'])).toHaveProperty('size', 1);
    expect(await repo.findActiveVoicemailTargets('tenant-1', ['vm-1'])).toHaveProperty('size', 1);
  });

  it('covers node registry token and nonce repository paths', async () => {
    const { encryptSipPassword } = await import('../crypto/sip-secret.js');
    const { NodeRegistryRepository } = await import('./runtime/node-registry.repository.js');
    const encrypted = encryptSipPassword('raw-token');
    const node = { id: 'node-1', display_name: 'FS node', status: 'active', allowed_cidrs: [], capabilities: [], rate_limit_policy: {} };
    const duplicate = new Error('duplicate nonce') as Error & { code: string };
    duplicate.code = '23505';
    const pool = makePool([
      rows([node]),
      row(node),
      row(node),
      row(node),
      empty(),
      row(node),
      row({ token_encrypted: encrypted.ciphertext, token_key_id: encrypted.keyId }),
      empty(),
      row({ token_encrypted: 'invalid', token_key_id: encrypted.keyId }),
      empty(),
      duplicate,
      empty(),
    ]);
    const repo = new NodeRegistryRepository(pool);

    await expect(repo.list()).resolves.toHaveLength(1);
    await expect(repo.findById('node-1')).resolves.toMatchObject({ id: 'node-1' });
    await expect(repo.create({ display_name: 'FS node' })).resolves.toMatchObject({ node });
    await expect(repo.update('node-1', {
      display_name: 'Updated',
      status: 'active',
      allowed_cidrs: ['10.0.0.0/24'],
      capabilities: ['directory'],
      rate_limit_policy: { rps: 10 },
    })).resolves.toMatchObject({ id: 'node-1' });
    await expect(repo.rotateToken('missing')).resolves.toBeNull();
    await expect(repo.rotateToken('node-1')).resolves.toMatchObject({ node });
    await expect(repo.getDecryptedToken('node-1')).resolves.toBe('raw-token');
    await expect(repo.getDecryptedToken('missing')).resolves.toBeNull();
    await expect(repo.getDecryptedToken('bad')).resolves.toBeNull();
    await expect(repo.checkAndConsumeNonce('node-1', 'nonce-1')).resolves.toBe(true);
    await expect(repo.checkAndConsumeNonce('node-1', 'nonce-1')).resolves.toBe(false);
    await expect(repo.cleanExpiredNonces()).resolves.toBeUndefined();
  });

  it('covers voicemail, user, extension, and idempotency repositories', async () => {
    const { VoicemailBoxRepository } = await import('./voicemail-boxes/voicemail-box.repository.js');
    const { VoicemailMessageRepository } = await import('./voicemail-boxes/voicemail-message.repository.js');
    const { UserRepository } = await import('./users/user.repository.js');
    const { ExtensionRepository } = await import('./extensions/extension.repository.js');
    const { IdempotencyRepository } = await import('./idempotency/idempotency.repository.js');

    const voicemailBox = { id: 'box-1', tenant_id: 'tenant-1', name: 'Main', mailbox_number: '9001', status: 'active' };
    const message = { id: 'message-1', tenant_id: 'tenant-1', voicemail_box_id: 'box-1', call_id: 'call-1' };
    const user = { id: 'user-1', tenant_id: 'tenant-1', email: 'user@example.test', display_name: 'User', role: 'tenant_admin', status: 'active' };
    const extension = { id: 'ext-1', tenant_id: 'tenant-1', extension_number: '1001', display_name: 'Desk', status: 'active', sip_username: '1001' };
    const pool = makePool([
      rows([voicemailBox]),
      row(voicemailBox),
      row({ id: 'box-1' }),
      row(voicemailBox),
      row(voicemailBox),
      row({ id: 'box-1' }),
      row(voicemailBox),
      empty(),
      row({ id: 'box-1' }),
      row(voicemailBox),
      row({ id: 'prompt-1', storage_uri: 'prompt.wav' }),
      rows([{ id: 'box-1' }]),
      row({ id: 'box-1', tenant_id: 'tenant-1', status: 'active' }),
      row(message),
      rows([message]),
      row(message),
      row({ id: 'message-1' }),
      rows([user]),
      row(user),
      row(user),
      row(user),
      row(user),
      rows([extension]),
      row(extension),
      row({ ...extension, directory_domain: 'pbx.test' }),
      row(extension),
      row(extension),
      row(extension),
      row(extension),
      row({ id: 'idem-1', response_body: { ok: true } }),
      empty(),
      row({ count: '3' }),
    ]);

    const boxes = new VoicemailBoxRepository(pool);
    await expect(boxes.findAllByTenant('tenant-1')).resolves.toHaveLength(1);
    await expect(boxes.findById('box-1', 'tenant-1')).resolves.toMatchObject({ id: 'box-1' });
    await expect(boxes.create({ tenant_id: 'tenant-1', name: 'Main', mailbox_number: '9001' })).resolves.toMatchObject({ id: 'box-1' });
    await expect(boxes.update('box-1', 'tenant-1', {})).resolves.toMatchObject({ id: 'box-1' });
    await expect(boxes.update('box-1', 'tenant-1', { name: 'Updated', description: null, greeting_prompt_id: null, status: 'active' })).resolves.toMatchObject({ id: 'box-1' });
    await expect(boxes.update('missing', 'tenant-1', { name: 'Missing' })).resolves.toBeNull();
    await expect(boxes.deactivate('box-1', 'tenant-1')).resolves.toMatchObject({ id: 'box-1' });
    await expect(boxes.findActivePrompt('prompt-1', 'tenant-1')).resolves.toMatchObject({ id: 'prompt-1' });
    await expect(boxes.isActiveTarget('box-1', 'tenant-1')).resolves.toBe(true);

    const messages = new VoicemailMessageRepository(pool);
    await expect(messages.findMailboxRuntimeRef('box-1')).resolves.toMatchObject({ id: 'box-1' });
    await expect(messages.create({ tenant_id: 'tenant-1', voicemail_box_id: 'box-1', call_id: 'call-1', storage_path: 'vm.wav' })).resolves.toMatchObject({ id: 'message-1' });
    await expect(messages.listByMailbox('tenant-1', 'box-1', { unreadOnly: true, limit: 10 })).resolves.toHaveLength(1);
    await expect(messages.markRead('message-1', 'tenant-1')).resolves.toMatchObject({ id: 'message-1' });
    await expect(messages.softDelete('message-1', 'tenant-1')).resolves.toBe(true);

    const users = new UserRepository(pool);
    await expect(users.listByTenant('tenant-1')).resolves.toHaveLength(1);
    await expect(users.findById('user-1', 'tenant-1')).resolves.toMatchObject({ id: 'user-1' });
    await expect(users.create({ tenant_id: 'tenant-1', email: 'user@example.test', display_name: 'User', role: 'tenant_admin', password_hash: 'hash' })).resolves.toMatchObject({ id: 'user-1' });
    await expect(users.update('user-1', 'tenant-1', { display_name: 'Updated', role: 'tenant_operator' })).resolves.toMatchObject({ id: 'user-1' });
    await expect(users.deactivate('user-1', 'tenant-1')).resolves.toMatchObject({ id: 'user-1' });

    const extensions = new ExtensionRepository(pool);
    await expect(extensions.findAllByTenant('tenant-1')).resolves.toHaveLength(1);
    await expect(extensions.findById('ext-1', 'tenant-1')).resolves.toMatchObject({ id: 'ext-1' });
    await expect(extensions.findActiveByDirectoryLookup('1001', 'pbx.test')).resolves.toMatchObject({ id: 'ext-1' });
    await expect(extensions.create({ tenant_id: 'tenant-1', extension_number: '1001', display_name: 'Desk', sip_password_ciphertext: 'cipher', sip_password_key_id: 'key' })).resolves.toMatchObject({ id: 'ext-1' });
    await expect(extensions.update('ext-1', 'tenant-1', {})).resolves.toMatchObject({ id: 'ext-1' });
    await expect(extensions.update('ext-1', 'tenant-1', { display_name: 'Updated', default_destination_type: null, default_destination_id: null })).resolves.toMatchObject({ id: 'ext-1' });
    await expect(extensions.deactivate('ext-1', 'tenant-1')).resolves.toMatchObject({ id: 'ext-1' });

    const idempotency = new IdempotencyRepository(pool);
    await expect(idempotency.find('tenant-1', 'key-1')).resolves.toMatchObject({ id: 'idem-1' });
    await expect(idempotency.store('tenant-1', 'key-1', 201, { ok: true })).resolves.toBeUndefined();
    await expect(idempotency.purgeExpired()).resolves.toBe(3);
  });

  it('covers outbound route, call group, prompt asset, and recording repositories', async () => {
    const { OutboundRouteRepository } = await import('./outbound-routes/outbound-route.repository.js');
    const { CallGroupRepository } = await import('./call-groups/call-group.repository.js');
    const { PromptAssetRepository } = await import('./prompts/prompt-asset.repository.js');
    const { RecordingRepository } = await import('./recordings/recording.repository.js');

    const route = { id: 'route-1', tenant_id: 'tenant-1', name: 'Route', status: 'active', match_prefix: '+1', priority: 10, sip_trunk_id: 'trunk-1' };
    const group = { id: 'group-1', tenant_id: 'tenant-1', name: 'Group', strategy: 'simultaneous', status: 'active' };
    const member = { id: 'member-1', call_group_id: 'group-1', tenant_id: 'tenant-1', extension_id: 'ext-1', position: 1 };
    const prompt = { id: 'prompt-1', tenant_id: 'tenant-1', name: 'Prompt', media_type: 'audio/wav', storage_uri: 'prompt.wav', status: 'active' };
    const recording = { id: 'recording-1', tenant_id: 'tenant-1', call_id: 'call-1', storage_path: 'recording.wav', status: 'available' };
    const analysis = {
      id: 'analysis-1',
      tenant_id: 'tenant-1',
      recording_id: 'recording-1',
      status: 'queued',
      requested_outputs: ['transcript'],
      language_hint: null,
      provider_hint: 'auto',
      transcript_status: 'queued',
      summary_status: null,
      processor_id: null,
      claimed_at: null,
      language: null,
      transcript_text: null,
      summary_text: null,
      error_message: null,
      provider_metadata: {},
      metadata: {},
      created_at: '2026-06-06T00:00:00.000Z',
      completed_at: null,
    };
    const policy = { id: 'policy-1', tenant_id: 'tenant-1', recording_retention_days: 30 };
    const hold = { id: 'hold-1', tenant_id: 'tenant-1', resource_type: 'recording', status: 'active' };
    const pool = makePool([
      rows([route]),
      empty(),
      row(route),
      row(route),
      row(route),
      row(route),
      row({ id: 'trunk-1' }),
      empty(),
      row({ route_id: 'route-1', sip_trunk_id: 'trunk-1' }),
      rows([group]),
      empty(),
      row(group),
      rows([member]),
      row(group),
      row(group),
      row(group),
      row(group),
      row({ id: 'ext-1' }),
      row(member),
      row({ extension_number: '1001', display_name: 'Desk' }),
      { rows: [], rowCount: 1 },
      empty(),
      rows([prompt]),
      row(prompt),
      row(prompt),
      row(prompt),
      row(prompt),
      row(prompt),
      row(recording),
      rows([recording]),
      row(recording),
      row(analysis),
      rows([analysis]),
      row(analysis),
      row({ ...analysis, status: 'processing' }),
      row({ ...analysis, status: 'completed' }),
      empty(),
      row(policy),
      row(hold),
      rows([hold]),
      row(hold),
      row({ ...hold, status: 'released' }),
      row({ exists: true }),
    ]);

    const routes = new OutboundRouteRepository(pool);
    await expect(routes.findAllByTenant('tenant-1')).resolves.toHaveLength(1);
    await expect(routes.findById('missing', 'tenant-1')).resolves.toBeNull();
    await expect(routes.create({
      tenant_id: 'tenant-1',
      name: 'Route',
      match_prefix: '+1',
      sip_trunk_id: 'trunk-1',
      allowed_caller_id_numbers_json: ['+1555'],
      allowed_destination_prefixes_json: ['+1'],
      blocked_destination_prefixes_json: ['+1900'],
    })).resolves.toMatchObject({ id: 'route-1' });
    await expect(routes.update('route-1', 'tenant-1', {})).resolves.toMatchObject({ id: 'route-1' });
    await expect(routes.update('route-1', 'tenant-1', {
      name: 'Updated',
      match_prefix: '+44',
      priority: 5,
      sip_trunk_id: 'trunk-1',
      fallback_sip_trunk_id: null,
      max_calls_per_minute: null,
      allowed_caller_id_numbers_json: null,
      allowed_destination_prefixes_json: ['+44'],
      blocked_destination_prefixes_json: null,
      status: 'active',
    })).resolves.toMatchObject({ id: 'route-1' });
    await expect(routes.deactivate('route-1', 'tenant-1')).resolves.toMatchObject({ id: 'route-1' });
    await expect(routes.findActiveTrunk('tenant-1', 'trunk-1')).resolves.toMatchObject({ id: 'trunk-1' });
    await expect(routes.findActiveTrunk('tenant-1', 'missing')).resolves.toBeNull();
    await expect(routes.resolveRouteForNumber('tenant-1', '+15551234567')).resolves.toMatchObject({ route_id: 'route-1' });

    const groups = new CallGroupRepository(pool);
    await expect(groups.findAllByTenant('tenant-1')).resolves.toHaveLength(1);
    await expect(groups.findById('missing', 'tenant-1')).resolves.toBeNull();
    await expect(groups.findById('group-1', 'tenant-1')).resolves.toMatchObject({ id: 'group-1', members: [member] });
    await expect(groups.create({ tenant_id: 'tenant-1', name: 'Group' })).resolves.toMatchObject({ id: 'group-1', members: [] });
    await expect(groups.update('group-1', 'tenant-1', {})).resolves.toMatchObject({ id: 'group-1' });
    await expect(groups.update('group-1', 'tenant-1', { name: 'Updated', description: null, strategy: 'sequential', status: 'active' })).resolves.toMatchObject({ id: 'group-1' });
    await expect(groups.deactivate('group-1', 'tenant-1')).resolves.toMatchObject({ id: 'group-1' });
    await expect(groups.findActiveExtension('ext-1', 'tenant-1')).resolves.toMatchObject({ id: 'ext-1' });
    await expect(groups.addMember('group-1', 'tenant-1', { extension_id: 'ext-1', position: 1 })).resolves.toMatchObject({ extension_number: '1001' });
    await expect(groups.removeMember('group-1', 'ext-1', 'tenant-1')).resolves.toBe(true);
    await expect(groups.isActiveTarget('group-1', 'tenant-1')).resolves.toBe(false);

    const prompts = new PromptAssetRepository(pool);
    await expect(prompts.findAllByTenant('tenant-1')).resolves.toHaveLength(1);
    await expect(prompts.findById('prompt-1', 'tenant-1')).resolves.toMatchObject({ id: 'prompt-1' });
    await expect(prompts.create({ tenant_id: 'tenant-1', name: 'Prompt', media_type: 'audio/wav', storage_uri: 'prompt.wav' })).resolves.toMatchObject({ id: 'prompt-1' });
    await expect(prompts.update('prompt-1', 'tenant-1', {})).resolves.toMatchObject({ id: 'prompt-1' });
    await expect(prompts.update('prompt-1', 'tenant-1', { name: 'Updated', language: null, checksum: null, status: 'active' })).resolves.toMatchObject({ id: 'prompt-1' });
    await expect(prompts.deactivate('prompt-1', 'tenant-1')).resolves.toMatchObject({ id: 'prompt-1' });

    const recordings = new RecordingRepository(pool);
    await expect(recordings.create({ tenant_id: 'tenant-1', call_id: 'call-1', storage_path: 'recording.wav' })).resolves.toMatchObject({ id: 'recording-1' });
    await expect(recordings.listByTenant('tenant-1', 'call-1')).resolves.toHaveLength(1);
    await expect(recordings.findById('recording-1', 'tenant-1')).resolves.toMatchObject({ id: 'recording-1' });
    await expect(recordings.createAnalysisRequest('recording-1', 'tenant-1', { requested_outputs: ['transcript'], metadata: { source: 'coverage' } })).resolves.toMatchObject({ id: 'analysis-1' });
    await expect(recordings.listAnalysisRequests('recording-1', 'tenant-1')).resolves.toHaveLength(1);
    await expect(recordings.findAnalysisRequest('analysis-1', 'tenant-1')).resolves.toMatchObject({ id: 'analysis-1' });
    await expect(recordings.claimAnalysisRequest('analysis-1', { processor_id: 'worker-1' })).resolves.toMatchObject({ status: 'processing' });
    await expect(recordings.completeAnalysisRequest('analysis-1', { status: 'completed', transcript_text: 'hello', provider_metadata: { model: 'coverage' } })).resolves.toMatchObject({ status: 'completed' });
    await expect(recordings.getRetentionPolicy('tenant-1')).resolves.toBeNull();
    await expect(recordings.upsertRetentionPolicy('tenant-1', { recording_retention_days: 30, voicemail_retention_days: null })).resolves.toMatchObject({ id: 'policy-1' });
    await expect(recordings.createLegalHold('tenant-1', 'user-1', { resource_type: 'recording', reason: 'coverage' })).resolves.toMatchObject({ id: 'hold-1' });
    await expect(recordings.listLegalHolds('tenant-1', { resource_type: 'recording', status: 'active' })).resolves.toHaveLength(1);
    await expect(recordings.findLegalHold('hold-1', 'tenant-1')).resolves.toMatchObject({ id: 'hold-1' });
    await expect(recordings.releaseLegalHold('hold-1', 'tenant-1', 'user-1')).resolves.toMatchObject({ status: 'released' });
    await expect(recordings.hasActiveLegalHold('tenant-1', 'recording', 'recording-1')).resolves.toBe(true);
  });

  it('covers queue repository CRUD and membership query paths', async () => {
    const { QueueRepository } = await import('./queues/queue.repository.js');
    const queue = { id: 'queue-1', tenant_id: 'tenant-1', name: 'Sales', strategy: 'sequential', status: 'active' };
    const member = { id: 'member-1', queue_id: 'queue-1', tenant_id: 'tenant-1', extension_id: 'ext-1', position: 1 };
    const pool = makePool([
      rows([queue]),
      empty(),
      row(queue),
      rows([member]),
      row(queue),
      row(queue),
      row(queue),
      row(queue),
      row({ id: 'ext-1' }),
      row(member),
      row({ extension_number: '1001', display_name: 'Desk' }),
      { rows: [], rowCount: 1 },
      rows([{ id: 'queue-1' }]),
    ]);
    const repo = new QueueRepository(pool);

    await expect(repo.findAllByTenant('tenant-1')).resolves.toHaveLength(1);
    await expect(repo.findById('missing', 'tenant-1')).resolves.toBeNull();
    await expect(repo.findById('queue-1', 'tenant-1')).resolves.toMatchObject({ id: 'queue-1', members: [member] });
    await expect(repo.create({ tenant_id: 'tenant-1', name: 'Sales' })).resolves.toMatchObject({ id: 'queue-1', members: [] });
    await expect(repo.update('queue-1', 'tenant-1', {})).resolves.toMatchObject({ id: 'queue-1' });
    await expect(repo.update('queue-1', 'tenant-1', {
      name: 'Support',
      description: null,
      strategy: 'simultaneous',
      ring_timeout_seconds: 15,
      retry_delay_seconds: 2,
      max_wait_seconds: 45,
      music_on_hold: null,
      overflow_target_type: null,
      overflow_target_id: null,
      status: 'active',
    })).resolves.toMatchObject({ id: 'queue-1' });
    await expect(repo.deactivate('queue-1', 'tenant-1')).resolves.toMatchObject({ id: 'queue-1' });
    await expect(repo.findActiveExtension('ext-1', 'tenant-1')).resolves.toMatchObject({ id: 'ext-1' });
    await expect(repo.addMember('queue-1', 'tenant-1', { extension_id: 'ext-1', position: 1 })).resolves.toMatchObject({ extension_number: '1001' });
    await expect(repo.removeMember('queue-1', 'ext-1', 'tenant-1')).resolves.toBe(true);
    await expect(repo.isActiveTarget('queue-1', 'tenant-1')).resolves.toBe(true);
  });

  it('covers automation API key, webhook, and delivery queue repository paths', async () => {
    const { AutomationRepository } = await import('./automation/automation.repository.js');
    const apiKey = {
      id: 'key-1',
      tenant_id: 'tenant-1',
      name: 'Automation',
      key_prefix: 'abcdef12',
      capabilities: ['ivr:read'],
      created_by: 'user-1',
      revoked_at: null,
    };
    const webhook = {
      id: 'webhook-1',
      tenant_id: 'tenant-1',
      name: 'Webhook',
      url: 'https://example.test/hook',
      events: ['call.completed'],
      signing_secret: 'secret',
      failure_count: 0,
      disabled_at: null,
      created_by: 'user-1',
      revoked_at: null,
    };
    const delivery = {
      id: 'delivery-1',
      webhook_id: 'webhook-1',
      tenant_id: 'tenant-1',
      event: 'call.completed',
      payload_json: { call_id: 'call-1' },
      status: 'pending',
      attempt_count: 0,
      max_attempts: 3,
      last_response_code: null,
      last_error: null,
    };
    const pool = makePool([
      row(apiKey),
      row({ id: 'key-1', tenant_id: 'tenant-1', capabilities: ['ivr:read'] }),
      empty(),
      rows([apiKey]),
      row({ id: 'key-1' }),
      empty(),
      row(webhook),
      rows([webhook]),
      row({ id: 'webhook-1' }),
      empty(),
      rows([{ id: 'webhook-1', url: webhook.url, signing_secret: webhook.signing_secret }]),
      empty(),
      empty(),
      empty(),
      rows([delivery]),
      rows([delivery]),
      row(delivery),
      empty(),
      row({ id: 'delivery-1' }),
      rows([{ ...delivery, status: 'processing', url: webhook.url, signing_secret: webhook.signing_secret }]),
      empty(),
      empty(),
      rows([{ id: 'log-1', webhook_id: 'webhook-1', tenant_id: 'tenant-1', event: 'call.completed', status: 'success' }]),
      rows([delivery]),
      row(webhook),
      empty(),
    ]);
    const repo = new AutomationRepository(pool);

    const generated = AutomationRepository.generateApiKey();
    expect(generated.rawKey).toMatch(/^mcak_/);
    expect(generated.keyHash).toBe(AutomationRepository.hashKey(generated.rawKey));
    expect(generated.keyPrefix).toHaveLength(8);
    expect(AutomationRepository.generateWebhookSecret()).toHaveLength(64);
    expect(AutomationRepository.signPayload('secret', '{"ok":true}')).toHaveLength(64);

    await expect(repo.createApiKey({
      tenant_id: 'tenant-1',
      name: 'Automation',
      key_prefix: 'abcdef12',
      key_hash: 'hash',
      capabilities: ['ivr:read'],
      created_by: 'user-1',
    })).resolves.toMatchObject({ id: 'key-1' });
    await expect(repo.findApiKeyByHash('hash')).resolves.toMatchObject({ id: 'key-1' });
    await expect(repo.findApiKeyByHash('missing')).resolves.toBeNull();
    await expect(repo.listApiKeys('tenant-1')).resolves.toHaveLength(1);
    await expect(repo.revokeApiKey('key-1', 'tenant-1')).resolves.toBe(true);
    await expect(repo.revokeApiKey('missing', 'tenant-1')).resolves.toBe(false);

    await expect(repo.createWebhook({
      tenant_id: 'tenant-1',
      name: 'Webhook',
      url: webhook.url,
      events: ['call.completed'],
      signing_secret: 'secret',
      created_by: 'user-1',
    })).resolves.toMatchObject({ id: 'webhook-1' });
    await expect(repo.listWebhooks('tenant-1')).resolves.toHaveLength(1);
    await expect(repo.revokeWebhook('webhook-1', 'tenant-1')).resolves.toBe(true);
    await expect(repo.revokeWebhook('missing', 'tenant-1')).resolves.toBe(false);
    await expect(repo.findActiveWebhooksForEvent('tenant-1', 'call.completed')).resolves.toHaveLength(1);
    await expect(repo.recordDeliveryFailure('webhook-1')).resolves.toBeUndefined();
    await expect(repo.resetDeliveryFailure('webhook-1')).resolves.toBeUndefined();
    await expect(repo.logDeliveryAttempt({
      webhook_id: 'webhook-1',
      tenant_id: 'tenant-1',
      event: 'call.completed',
      attempt_number: 1,
      status: 'success',
      response_code: 200,
      duration_ms: 25,
    })).resolves.toBeUndefined();
    await expect(repo.enqueueWebhookDeliveries({
      tenant_id: 'tenant-1',
      event: 'call.completed',
      payload_json: { call_id: 'call-1' },
      event_id: '00000000-0000-0000-0000-000000000001',
    })).resolves.toHaveLength(1);
    await expect(repo.listAbandonedDeliveries('tenant-1')).resolves.toHaveLength(1);
    await expect(repo.retryAbandonedDelivery('delivery-1', 'tenant-1')).resolves.toMatchObject({ id: 'delivery-1' });
    await expect(repo.dismissAbandonedDelivery('missing', 'tenant-1')).resolves.toBe(false);
    await expect(repo.dismissAbandonedDelivery('delivery-1', 'tenant-1', 'duplicate')).resolves.toBe(true);
    await expect(repo.claimDueWebhookDeliveries(10)).resolves.toHaveLength(1);
    await expect(repo.markWebhookDeliveryDelivered({ delivery_id: 'delivery-1', response_code: 200 })).resolves.toBeUndefined();
    await expect(repo.markWebhookDeliveryFailed({
      delivery_id: 'delivery-1',
      response_code: 500,
      error_message: 'failed',
      retry_delay_seconds: 30,
    })).resolves.toBeUndefined();
    await expect(repo.findDeliveryLog('webhook-1')).resolves.toHaveLength(1);
    await expect(repo.findDeliveryQueueForWebhook('webhook-1', 'tenant-1')).resolves.toHaveLength(1);
    await expect(repo.findWebhookById('webhook-1', 'tenant-1')).resolves.toMatchObject({ id: 'webhook-1' });
    await expect(repo.findWebhookById('missing', 'tenant-1')).resolves.toBeNull();
  });

  it('covers approval and platform repository query paths', async () => {
    const { ApprovalRepository } = await import('./approvals/approval.repository.js');
    const { PlatformRepository } = await import('./platform/platform.repository.js');
    const approval = {
      id: 'approval-1',
      tenant_id: 'tenant-1',
      object_type: 'ivr_flow',
      object_id: 'flow-1',
      version_id: 'version-1',
      requested_by: 'user-1',
      status: 'pending',
      flow_name: 'Main IVR',
      action_type: 'publish',
    };
    const publishRecord = {
      id: 'publish-1',
      object_id: 'flow-1',
      version_id: 'version-1',
      action_type: 'publish',
    };
    const tenant = {
      id: 'tenant-1',
      name: 'Tenant',
      slug: 'tenant',
      directory_domain: 'tenant.managecallai.local',
      status: 'active',
    };
    const runtimeSummary = {
      active_sessions: 1,
      completed_sessions_24h: 2,
      failed_sessions_24h: 0,
      call_events_24h: 10,
      failed_runtime_ingestions_24h: 0,
      pending_approvals: 1,
    };
    const pool = makePool([
      rows([approval]),
      row(approval),
      empty(),
      row(publishRecord),
      { rows: [], rowCount: 1 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 1 },
      { rows: [], rowCount: 0 },
      empty(),
      empty(),
      rows([{ id: 'policy-1', tenant_id: 'tenant-1', policy_type: 'publish_approval', status: 'active', rules: {} }]),
      rows([tenant]),
      row(runtimeSummary),
    ]);

    const approvals = new ApprovalRepository(pool);
    await expect(approvals.findPendingByTenant('tenant-1')).resolves.toHaveLength(1);
    await expect(approvals.findById('approval-1', 'tenant-1')).resolves.toMatchObject({ id: 'approval-1' });
    await expect(approvals.findById('missing', 'tenant-1')).resolves.toBeNull();
    await expect(approvals.findAssociatedPublishRecord('approval-1')).resolves.toMatchObject({ id: 'publish-1' });
    await expect(approvals.markApproved('approval-1', 'tenant-1', 'user-1')).resolves.toBe(true);
    await expect(approvals.markApproved('missing', 'tenant-1', 'user-1')).resolves.toBe(false);
    await expect(approvals.markRejected('approval-1', 'tenant-1', 'user-1')).resolves.toBe(true);
    await expect(approvals.markRejected('missing', 'tenant-1', 'user-1')).resolves.toBe(false);
    await expect(approvals.updatePublishRecordResult('approval-1', 'success')).resolves.toBeUndefined();
    await expect(approvals.writeAuditEvent({
      tenant_id: 'tenant-1',
      actor_id: 'user-1',
      action: 'approval.approved',
      object_type: 'approval_request',
      object_id: 'approval-1',
    })).resolves.toBeUndefined();
    await expect(approvals.listPolicies('tenant-1')).resolves.toHaveLength(1);

    const platform = new PlatformRepository(pool);
    await expect(platform.listTenants()).resolves.toHaveLength(1);
    await expect(platform.getRuntimeSummary()).resolves.toMatchObject({ active_sessions: 1 });
  });
});
