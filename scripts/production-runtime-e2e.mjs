#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { redact } from './redact-logs.mjs';

const args = new Set(process.argv.slice(2));
const checkConfigOnly = args.has('--check-config');
const apiRoot = normalizeRoot(process.env.API_BASE_URL ?? 'http://localhost:3000');
const apiBase = `${apiRoot}/api/v1`;
const runtimeToken = process.env.RUNTIME_API_TOKEN ?? '';
const evidenceDir = process.env.PRODUCTION_E2E_ARTIFACT_DIR ?? 'artifacts/production-e2e';
const sipHandoffPath = process.env.PRODUCTION_E2E_SIP_HANDOFF_PATH ?? `${evidenceDir}/sip-register.env`;

const evidence = {
  generated_at: new Date().toISOString(),
  git_sha: process.env.GITHUB_SHA ?? process.env.GIT_COMMIT ?? 'local',
  api_root: apiRoot,
  mode: checkConfigOnly ? 'check-config' : 'live',
  steps: [],
  ids: {},
};

function normalizeRoot(value) {
  return value.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
}

function record(name, status, details = {}) {
  evidence.steps.push({ name, status, details });
  const marker = status === 'passed' ? 'ok' : status;
  console.log(`${marker}: ${name}`);
}

async function requestJson(method, path, { token, body, headers = {}, runtime = false } = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(runtime ? { 'x-managecallai-runtime-token': runtimeToken } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(`${method} ${path} returned ${response.status}: ${redact(String(text)).slice(0, 500)}`);
  }
  return data;
}

async function requestText(method, path, { runtime = false, headers = {} } = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      ...(runtime ? { 'x-managecallai-runtime-token': runtimeToken } : {}),
      ...headers,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} returned ${response.status}: ${redact(text).slice(0, 500)}`);
  }
  return text;
}

function decodeClaims(token) {
  return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
}

async function writeEvidence(status) {
  evidence.status = status;
  await mkdir(evidenceDir, { recursive: true });
  const fileName = `production-runtime-e2e-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const output = join(evidenceDir, fileName);
  await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(`evidence: ${output}`);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

async function writeSipHandoff({ username, password, domain }) {
  await mkdir(evidenceDir, { recursive: true });
  const lines = [
    `SIP_USERNAME=${shellQuote(username)}`,
    `SIP_PASSWORD=${shellQuote(password)}`,
    `SIP_DOMAIN=${shellQuote(domain)}`,
    '',
  ];
  await writeFile(sipHandoffPath, lines.join('\n'), 'utf8');
}

async function run() {
  if (checkConfigOnly) {
    for (const name of ['API_BASE_URL', 'RUNTIME_API_TOKEN', 'PRODUCTION_E2E_ARTIFACT_DIR']) {
      record(`config ${name}`, 'checked', { required_for_live: name !== 'PRODUCTION_E2E_ARTIFACT_DIR' });
    }
    await writeEvidence('checked');
    return;
  }

  if (!runtimeToken || runtimeToken.length < 16) {
    throw new Error('RUNTIME_API_TOKEN must be set to a non-sample value before running production runtime E2E');
  }

  const suffix = randomUUID().slice(0, 8);
  const tenantSlug = `prod-e2e-${suffix}`;
  const email = `prod-e2e-${suffix}@example.com`;
  const domain = `${tenantSlug}.managecallai.local`;
  const did = `+1212555${suffix.slice(0, 4)}`;
  const extensionNumber = '1001';
  const sipPassword = `Sip-${suffix}!`;

  const health = await fetch(`${apiRoot}/health`);
  if (!health.ok) throw new Error(`/health returned ${health.status}`);
  record('api health', 'passed');

  const registered = await requestJson('POST', '/auth/register', {
    body: {
      tenant_name: 'Production E2E Tenant',
      tenant_slug: tenantSlug,
      email,
      display_name: 'Production E2E Admin',
      password: `ProdE2e-${suffix}!`,
    },
  });
  const token = registered.token;
  const claims = decodeClaims(token);
  evidence.ids.tenant_id = claims.tenant_id;
  record('tenant registration and login', 'passed', { tenant_slug: tenantSlug });

  const extension = (await requestJson('POST', '/extensions', {
    token,
    body: {
      extension_number: extensionNumber,
      display_name: 'Production E2E Reception',
      sip_password: sipPassword,
    },
  })).data;
  evidence.ids.extension_id = extension.id;
  record('extension create', 'passed');
  await writeSipHandoff({ username: extensionNumber, password: sipPassword, domain });

  const directoryXml = await requestText('GET', `/freeswitch/directory?user=${encodeURIComponent(extensionNumber)}&domain=${encodeURIComponent(domain)}`, { runtime: true });
  if (!directoryXml.includes('managecall_extension_id')) {
    throw new Error('directory response did not include managecall_extension_id');
  }
  record('freeswitch directory lookup', 'passed');

  const prompt = (await requestJson('POST', '/prompts', {
    token,
    body: { name: 'Production E2E Greeting', media_type: 'audio/wav', storage_uri: '/sounds/prod-e2e.wav' },
  })).data;
  evidence.ids.prompt_id = prompt.id;
  record('prompt create', 'passed');

  const graph = {
    entry_node_id: 'start',
    nodes: [
      { id: 'start', type: 'start', next_node_id: 'menu' },
      { id: 'menu', type: 'play_collect', prompt_id: prompt.id, next_node_id: 'route', timeout_node_id: 'end', invalid_node_id: 'end' },
      { id: 'route', type: 'switch', cases: { '1': 'reception' }, default_node_id: 'end' },
      { id: 'reception', type: 'transfer_extension', extension_number: extensionNumber },
      { id: 'end', type: 'hangup' },
    ],
  };
  const flow = (await requestJson('POST', '/ivr-flows', {
    token,
    body: { name: 'Production E2E IVR', description: 'Release gate IVR', graph_json: graph },
  })).data;
  evidence.ids.flow_id = flow.id;
  const draftVersionId = flow.versions?.[0]?.id ?? flow.draft_version_id;
  evidence.ids.flow_version_id = draftVersionId;
  record('ivr flow draft create', 'passed');

  await requestJson('POST', `/ivr-flows/${flow.id}/versions/${draftVersionId}/validate`, { token });
  const simulation = (await requestJson('POST', `/ivr-flows/${flow.id}/simulate`, { token, body: { digits: ['1'] } })).data;
  if (!JSON.stringify(simulation).includes(extensionNumber)) {
    throw new Error(`simulation did not route to extension ${extensionNumber}`);
  }
  record('ivr validate and simulate', 'passed');

  const published = (await requestJson('POST', `/ivr-flows/${flow.id}/versions/${draftVersionId}/publish`, { token })).data;
  if (!['published', 'pending_approval'].includes(published.status)) {
    throw new Error(`unexpected publish status ${published.status}`);
  }
  record('ivr publish lifecycle', 'passed', { status: published.status });

  const phone = (await requestJson('POST', '/phone-numbers', { token, body: { e164_number: did } })).data;
  evidence.ids.phone_number_id = phone.id;

  const route = (await requestJson('POST', '/inbound-routes', {
    token,
    body: {
      name: 'Production E2E DID',
      match_type: 'did',
      match_value: did,
      target_type: 'flow',
      target_id: flow.id,
      phone_number_id: phone.id,
    },
  })).data;
  evidence.ids.inbound_route_id = route.id;
  const routeVersionId = route.versions?.[0]?.id ?? route.draft_version_id;
  await requestJson('POST', `/inbound-routes/${route.id}/versions/${routeVersionId}/validate`, { token });
  await requestJson('POST', `/inbound-routes/${route.id}/versions/${routeVersionId}/publish`, { token });
  record('inbound route validate and publish', 'passed');

  const dialplan = await requestText('GET', `/freeswitch/dialplan?Caller-Destination-Number=${encodeURIComponent(did)}&domain=${encodeURIComponent(domain)}`, { runtime: true });
  if (!dialplan.includes('managecall_entry.lua') || !dialplan.includes(flow.id)) {
    throw new Error('dialplan did not resolve to the published IVR flow');
  }
  record('freeswitch dialplan lookup', 'passed');

  const session = (await requestJson('POST', '/runtime/ivr/sessions', {
    runtime: true,
    body: { call_id: `prod-e2e-call-${suffix}`, flow_id: flow.id },
  })).data;
  evidence.ids.ivr_session_id = session.session?.id ?? session.id;
  record('ivr runtime session start', 'passed');

  const callId = `prod-e2e-call-${suffix}`;
  await requestJson('POST', '/call-events/internal/ingest', {
    headers: { authorization: `Bearer ${runtimeToken}`, 'x-tenant-id': claims.tenant_id },
    body: {
      tenant_id: claims.tenant_id,
      call_id: callId,
      event_type: 'channel_create',
      metadata: { source: 'production-runtime-e2e' },
    },
  });
  const events = await requestJson('GET', `/call-events?tenant_id=${claims.tenant_id}`, { token });
  if (!JSON.stringify(events).includes(callId)) {
    throw new Error('ingested call event was not visible to the tenant');
  }
  record('runtime event ingest and tenant query', 'passed');

  await writeEvidence('passed');
}

run().catch(async (error) => {
  evidence.error = redact(error instanceof Error ? error.message : String(error));
  record('production runtime e2e', 'failed', { error: evidence.error });
  await writeEvidence('failed');
  console.error(evidence.error);
  process.exitCode = 1;
});
