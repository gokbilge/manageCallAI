#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const checkConfigOnly = args.includes('--check-config');
const manifestArg = args.find((arg) => arg.startsWith('--manifest='));
const manifestPath = manifestArg?.slice('--manifest='.length) ?? process.env.RELEASE_EVIDENCE_MANIFEST;

const requiredEvidence = [
  'ci_run_url',
  'codeql_run_url',
  'coverage_run_url',
  'docker_images_run_url',
  'production_preflight',
  'production_e2e',
  'production_soak',
  'production_slo',
  'restore_smoke',
  'rate_limit_topology',
  'carrier_interop',
  'security_review',
  'rollback_plan',
  'operator_signoff',
];

if (checkConfigOnly) {
  console.log('release evidence configuration check passed');
  process.exit(0);
}

if (!manifestPath) {
  console.error('release evidence manifest is required: pass --manifest=<file> or set RELEASE_EVIDENCE_MANIFEST');
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
}

function hasValue(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value === true;
}

try {
  const manifest = readJson(manifestPath);
  const failures = [];

  if (!manifest.release_version) failures.push('release_version is required');
  if (!manifest.commit_sha) failures.push('commit_sha is required');
  if (!manifest.generated_at) failures.push('generated_at is required');

  for (const key of requiredEvidence) {
    if (!hasValue(manifest[key])) failures.push(`${key} evidence is required`);
  }

  for (const [key, value] of Object.entries(manifest.artifact_files ?? {})) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      failures.push(`artifact_files.${key} must be a non-empty path`);
      continue;
    }
    if (!existsSync(value)) failures.push(`artifact_files.${key} does not exist: ${value}`);
  }

  const signoff = manifest.operator_signoff ?? {};
  for (const field of ['name', 'role', 'approved_at']) {
    if (!signoff[field]) failures.push(`operator_signoff.${field} is required`);
  }

  if (failures.length > 0) {
    console.error(`release evidence check failed (${failures.length} issue(s))`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log(`release evidence check passed for ${manifest.release_version} at ${manifest.commit_sha}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
