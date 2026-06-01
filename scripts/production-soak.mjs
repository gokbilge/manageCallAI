#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { redact } from './redact-logs.mjs';

const args = new Set(process.argv.slice(2));
const checkConfigOnly = args.has('--check-config');

const apiRoot = normalizeRoot(process.env.API_BASE_URL ?? 'http://localhost:3000');
const apiBase = `${apiRoot}/api/v1`;
const runtimeToken = process.env.RUNTIME_API_TOKEN ?? '';
const tenantId = process.env.SOAK_TENANT_ID ?? process.env.MANAGECALLAI_TENANT_ID ?? '';
const durationSeconds = positiveInt(process.env.SOAK_DURATION_SECONDS, 60);
const concurrency = positiveInt(process.env.SOAK_CONCURRENCY, 4);
const targetRps = positiveInt(process.env.SOAK_TARGET_RPS, 10);
const artifactDir = process.env.SOAK_ARTIFACT_DIR ?? 'artifacts/production-soak';

const evidence = {
  generated_at: new Date().toISOString(),
  mode: checkConfigOnly ? 'check-config' : 'live',
  api_root: apiRoot,
  duration_seconds: durationSeconds,
  concurrency,
  target_rps: targetRps,
  counters: {
    health_ok: 0,
    ingest_ok: 0,
    failures: 0,
  },
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

async function writeEvidence(status) {
  evidence.status = status;
  await mkdir(artifactDir, { recursive: true });
  const fileName = `production-soak-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const output = join(artifactDir, fileName);
  await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(`evidence: ${output}`);
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} returned ${response.status}: ${redact(text).slice(0, 300)}`);
  }
  return text;
}

async function healthProbe() {
  const response = await fetch(`${apiRoot}/health`);
  if (!response.ok) throw new Error(`/health returned ${response.status}`);
  evidence.counters.health_ok += 1;
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

async function worker(workerId, deadline) {
  let sequence = 0;
  const intervalMs = Math.max(10, Math.floor((1000 * concurrency) / targetRps));
  while (Date.now() < deadline) {
    sequence += 1;
    try {
      if (sequence % 10 === 0) {
        await healthProbe();
      } else {
        await ingestProbe(workerId, sequence);
      }
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
  if (!tenantId) {
    throw new Error('SOAK_TENANT_ID or MANAGECALLAI_TENANT_ID is required for live production soak');
  }

  await healthProbe();
  const deadline = Date.now() + durationSeconds * 1000;
  await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index + 1, deadline)));

  const total = evidence.counters.health_ok + evidence.counters.ingest_ok + evidence.counters.failures;
  evidence.failure_rate = total === 0 ? 1 : evidence.counters.failures / total;
  const status = evidence.failure_rate <= 0.01 ? 'passed' : 'failed';
  await writeEvidence(status);
  if (status !== 'passed') {
    throw new Error(`production soak failure rate exceeded threshold: ${evidence.failure_rate}`);
  }
}

run().catch(async (error) => {
  evidence.errors.push(redact(error instanceof Error ? error.message : String(error)));
  await writeEvidence('failed');
  console.error(evidence.errors.at(-1));
  process.exitCode = 1;
});
