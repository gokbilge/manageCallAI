#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { redact } from './redact-logs.mjs';

const args = new Set(process.argv.slice(2));
const checkConfigOnly = args.has('--check-config');

const apiRoot = normalizeRoot(process.env.API_BASE_URL ?? 'http://localhost:3000');
const apiBase = `${apiRoot}/api/v1`;
const runtimeToken = process.env.RUNTIME_API_TOKEN ?? '';
let tenantId = process.env.SOAK_TENANT_ID ?? process.env.MANAGECALLAI_TENANT_ID ?? '';
let directoryDomain = process.env.SOAK_DIRECTORY_DOMAIN ?? '';
let extensionNumber = process.env.SOAK_EXTENSION_NUMBER ?? '1001';
let dialplanDestination = process.env.SOAK_DIALPLAN_DESTINATION ?? '';
const durationSeconds = positiveInt(process.env.SOAK_DURATION_SECONDS, 60);
const concurrency = positiveInt(process.env.SOAK_CONCURRENCY, 4);
const targetRps = positiveInt(process.env.SOAK_TARGET_RPS, 10);
const artifactDir = process.env.SOAK_ARTIFACT_DIR ?? 'artifacts/production-soak';
const sloArtifactPath = process.env.PRODUCTION_SLO_OUTPUT ?? 'artifacts/release/runtime-slo.json';
const environment = process.env.SOAK_ENVIRONMENT ?? process.env.APP_ENV ?? 'staging-prod-candidate';

const samples = new Map([
  ['/health/ready', []],
  ['/api/v1/freeswitch/directory', []],
  ['/api/v1/freeswitch/dialplan', []],
]);

const evidence = {
  generated_at: new Date().toISOString(),
  mode: checkConfigOnly ? 'check-config' : 'live',
  api_root: apiRoot,
  environment,
  duration_seconds: durationSeconds,
  concurrency,
  target_rps: targetRps,
  counters: {
    health_ok: 0,
    ready_ok: 0,
    directory_ok: 0,
    dialplan_ok: 0,
    ingest_ok: 0,
    failures: 0,
  },
  endpoints: [],
  errors: [],
};

function normalizeRoot(value) {
  return value.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, pct) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * pct) - 1);
  return Number(sorted[index].toFixed(2));
}

async function measure(path, fn) {
  const start = performance.now();
  const result = await fn();
  samples.get(path)?.push(Number((performance.now() - start).toFixed(2)));
  return result;
}

async function writeEvidence(status) {
  evidence.status = status;
  evidence.endpoints = [...samples.entries()].map(([path, values]) => ({
    path,
    sample_count: values.length,
    p95_ms: percentile(values, 0.95),
    p99_ms: percentile(values, 0.99),
  }));

  await mkdir(artifactDir, { recursive: true });
  const fileName = `production-soak-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const output = join(artifactDir, fileName);
  await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(`evidence: ${output}`);

  if (status === 'passed') {
    const sloEvidence = {
      generated_at: evidence.generated_at,
      environment,
      endpoints: evidence.endpoints,
    };
    await mkdir(dirname(sloArtifactPath), { recursive: true });
    await writeFile(sloArtifactPath, `${JSON.stringify(sloEvidence, null, 2)}\n`, 'utf8');
    console.log(`slo evidence: ${sloArtifactPath}`);
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} returned ${response.status}: ${redact(text).slice(0, 300)}`);
  }
  return text;
}

async function requestJson(method, path, { token, body, runtime = false } = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(runtime ? { 'x-managecallai-runtime-token': runtimeToken } : {}),
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
    throw new Error(`${method} ${path} returned ${response.status}: ${redact(String(text)).slice(0, 300)}`);
  }
  return data;
}

async function healthProbe() {
  const response = await fetch(`${apiRoot}/health`);
  if (!response.ok) throw new Error(`/health returned ${response.status}`);
  evidence.counters.health_ok += 1;
}

async function readyProbe() {
  await measure('/health/ready', async () => {
    const response = await fetch(`${apiRoot}/health/ready`);
    if (!response.ok) throw new Error(`/health/ready returned ${response.status}`);
  });
  evidence.counters.ready_ok += 1;
}

async function directoryProbe() {
  await measure('/api/v1/freeswitch/directory', async () => {
    await request(
      `/freeswitch/directory?user=${encodeURIComponent(extensionNumber)}&domain=${encodeURIComponent(directoryDomain)}`,
      { headers: { 'x-managecallai-runtime-token': runtimeToken } },
    );
  });
  evidence.counters.directory_ok += 1;
}

async function dialplanProbe() {
  await measure('/api/v1/freeswitch/dialplan', async () => {
    await request(
      `/freeswitch/dialplan?Caller-Destination-Number=${encodeURIComponent(dialplanDestination)}&domain=${encodeURIComponent(directoryDomain)}`,
      { headers: { 'x-managecallai-runtime-token': runtimeToken } },
    );
  });
  evidence.counters.dialplan_ok += 1;
}

async function ingestProbe(workerId, sequence) {
  await request('/call-events/internal/ingest', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${runtimeToken}`,
      'content-type': 'application/json',
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      call_id: `soak-${workerId}-${sequence}`,
      event_type: 'channel_create',
      metadata: { source: 'production-soak', worker_id: workerId, sequence },
    }),
  });
  evidence.counters.ingest_ok += 1;
}

function decodeClaims(token) {
  return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
}

async function provisionSoakTenant() {
  const suffix = randomUUID().slice(0, 8);
  const tenantSlug = `prod-soak-${suffix}`;
  const email = `prod-soak-${suffix}@example.com`;
  directoryDomain = `${tenantSlug}.managecallai.local`;
  dialplanDestination = `+1212556${suffix.slice(0, 4)}`;
  extensionNumber = '1001';

  const registered = await requestJson('POST', '/auth/register', {
    body: {
      tenant_name: 'Production Soak Tenant',
      tenant_slug: tenantSlug,
      email,
      display_name: 'Production Soak Admin',
      password: `ProdSoak-${suffix}!`,
    },
  });
  const token = registered.token;
  tenantId = decodeClaims(token).tenant_id;
  evidence.tenant_source = 'provisioned';

  await requestJson('POST', '/extensions', {
    token,
    body: {
      extension_number: extensionNumber,
      display_name: 'Production Soak Reception',
      sip_password: `Soak-${suffix}!`,
    },
  });

  const prompt = (await requestJson('POST', '/prompts', {
    token,
    body: { name: 'Production Soak Greeting', media_type: 'audio/wav', storage_uri: '/sounds/prod-soak.wav' },
  })).data;

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
    body: { name: 'Production Soak IVR', description: 'Runtime SLO soak IVR', graph_json: graph },
  })).data;
  const versionId = flow.versions?.[0]?.id ?? flow.draft_version_id;
  await requestJson('POST', `/ivr-flows/${flow.id}/versions/${versionId}/validate`, { token });
  await requestJson('POST', `/ivr-flows/${flow.id}/versions/${versionId}/publish`, { token });

  const phone = (await requestJson('POST', '/phone-numbers', {
    token,
    body: { e164_number: dialplanDestination },
  })).data;
  const route = (await requestJson('POST', '/inbound-routes', {
    token,
    body: {
      name: 'Production Soak DID',
      match_type: 'did',
      match_value: dialplanDestination,
      target_type: 'flow',
      target_id: flow.id,
      phone_number_id: phone.id,
    },
  })).data;
  const routeVersionId = route.versions?.[0]?.id ?? route.draft_version_id;
  await requestJson('POST', `/inbound-routes/${route.id}/versions/${routeVersionId}/validate`, { token });
  await requestJson('POST', `/inbound-routes/${route.id}/versions/${routeVersionId}/publish`, { token });
}

async function worker(workerId, deadline) {
  let sequence = 0;
  const intervalMs = Math.max(10, Math.floor((1000 * concurrency) / targetRps));
  while (Date.now() < deadline) {
    sequence += 1;
    try {
      const probe = sequence % 4;
      if (probe === 0) await readyProbe();
      else if (probe === 1) await directoryProbe();
      else if (probe === 2) await dialplanProbe();
      else await ingestProbe(workerId, sequence);
    } catch (error) {
      evidence.counters.failures += 1;
      if (evidence.errors.length < 20) {
        evidence.errors.push(redact(error instanceof Error ? error.message : String(error)));
      }
    }
    await sleep(intervalMs);
  }
}

async function run() {
  if (checkConfigOnly) {
    console.log('production soak configuration check passed');
    await writeEvidence('checked');
    return;
  }

  if (!runtimeToken || runtimeToken.length < 16) {
    throw new Error('RUNTIME_API_TOKEN is required for live production soak');
  }

  if (!tenantId || !directoryDomain || !dialplanDestination) {
    await provisionSoakTenant();
  }

  await healthProbe();
  await readyProbe();
  await directoryProbe();
  await dialplanProbe();
  const deadline = Date.now() + durationSeconds * 1000;
  await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index + 1, deadline)));

  const total = Object.values(evidence.counters).reduce((sum, value) => sum + value, 0);
  evidence.failure_rate = total === 0 ? 1 : evidence.counters.failures / total;
  const missingSamples = [...samples.values()].some((values) => values.length === 0);
  const status = evidence.failure_rate <= 0.01 && !missingSamples ? 'passed' : 'failed';
  await writeEvidence(status);
  if (status !== 'passed') {
    throw new Error(`production soak failed: failure_rate=${evidence.failure_rate}, missing_samples=${missingSamples}`);
  }
}

run().catch(async (error) => {
  evidence.errors.push(redact(error instanceof Error ? error.message : String(error)));
  await writeEvidence('failed');
  console.error(evidence.errors.at(-1));
  process.exitCode = 1;
});
