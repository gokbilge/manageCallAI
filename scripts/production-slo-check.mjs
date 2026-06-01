#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const checkConfigOnly = args.includes('--check-config');
const evidenceArg = args.find((arg) => arg.startsWith('--evidence='));
const evidencePath = evidenceArg?.slice('--evidence='.length) ?? process.env.PRODUCTION_SLO_EVIDENCE;

const requiredEndpoints = new Map([
  ['/api/v1/freeswitch/directory', { target_p99_ms: 50, breach_p99_ms: 200 }],
  ['/api/v1/freeswitch/dialplan', { target_p99_ms: 100, breach_p99_ms: 500 }],
  ['/health/ready', { target_p99_ms: 20, breach_p99_ms: 100 }],
]);

if (checkConfigOnly) {
  console.log('production SLO configuration check passed');
  process.exit(0);
}

if (!evidencePath) {
  console.error('production SLO evidence is required: pass --evidence=<file> or set PRODUCTION_SLO_EVIDENCE');
  process.exit(1);
}

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

try {
  const raw = (await readFile(evidencePath, 'utf8')).replace(/^\uFEFF/, '');
  const evidence = JSON.parse(raw);
  const failures = [];
  const warnings = [];

  if (!evidence.generated_at) failures.push('generated_at is required');
  if (!evidence.environment) failures.push('environment is required');
  if (!Array.isArray(evidence.endpoints)) failures.push('endpoints must be an array');

  const endpoints = new Map((evidence.endpoints ?? []).map((entry) => [entry.path, entry]));

  for (const [path, limits] of requiredEndpoints) {
    const endpoint = endpoints.get(path);
    if (!endpoint) {
      failures.push(`missing endpoint evidence: ${path}`);
      continue;
    }

    if (!isPositiveNumber(endpoint.sample_count) || endpoint.sample_count < 1) {
      failures.push(`${path} sample_count must be a positive number`);
    }
    if (!isPositiveNumber(endpoint.p95_ms)) {
      failures.push(`${path} p95_ms must be a non-negative number`);
    }
    if (!isPositiveNumber(endpoint.p99_ms)) {
      failures.push(`${path} p99_ms must be a non-negative number`);
      continue;
    }
    if (endpoint.p99_ms > limits.breach_p99_ms) {
      failures.push(`${path} p99_ms ${endpoint.p99_ms} exceeds breach threshold ${limits.breach_p99_ms}`);
    } else if (endpoint.p99_ms > limits.target_p99_ms) {
      warnings.push(`${path} p99_ms ${endpoint.p99_ms} exceeds target ${limits.target_p99_ms}`);
    }
  }

  for (const warning of warnings) console.warn(`WARN: ${warning}`);

  if (failures.length > 0) {
    console.error(`production SLO check failed (${failures.length} issue(s))`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log(`production SLO check passed for ${evidence.environment}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
