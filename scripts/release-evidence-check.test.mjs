/**
 * Tests for release-evidence-check.mjs
 * Run with: node --test scripts/release-evidence-check.test.mjs
 */

import { strictEqual, ok } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const script = new URL('./release-evidence-check.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

function run(args, env = {}) {
  return spawnSync('node', [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function writeTmp(name, content) {
  const dir = join(tmpdir(), 'release-evidence-test');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(content, null, 2));
  return path;
}

const artifactsDir = join(tmpdir(), 'release-evidence-artifacts');
mkdirSync(artifactsDir, { recursive: true });
const runtimeSloPath = join(artifactsDir, 'runtime-slo.json');
writeFileSync(runtimeSloPath, JSON.stringify({ status: 'passed' }, null, 2));

const validBetaManifest = {
  release_version: 'v0.2.0-beta.1',
  commit_sha: '0123456789abcdef0123456789abcdef01234567',
  generated_at: '2026-06-03T00:00:00Z',
  stage: 'beta',
  notes: 'Beta candidate evidence bundle for v0.2.0-beta.1.',
  ci_run_url: 'https://github.com/gokbilge/manageCallAI/actions/runs/1',
  codeql_run_url: 'https://github.com/gokbilge/manageCallAI/actions/runs/2',
  coverage_run_url: 'https://github.com/gokbilge/manageCallAI/actions/runs/3',
  docker_images_run_url: 'https://github.com/gokbilge/manageCallAI/actions/runs/4',
  freeswitch_smoke_run_url: 'https://github.com/gokbilge/manageCallAI/actions/runs/5',
  production_preflight: 'Validated against beta candidate environment with sanitized artifact ref.',
  production_e2e: 'Self-hosted smoke run artifact attached for beta candidate.',
  production_soak: 'Lab soak evidence retained for beta candidate documentation.',
  production_slo: 'Runtime lookup latencies recorded in sanitized artifact.',
  restore_smoke: 'Restore rehearsal artifact recorded for the candidate line.',
  rate_limit_topology: 'Single-instance beta topology validated.',
  carrier_interop: ['Lab interop artifact attached for beta candidate context.'],
  log_redaction: 'Sanitized redaction artifact attached for the candidate line.',
  rotation_rehearsal: 'Rotation rehearsal artifact attached for the candidate line.',
  network_config: 'Target network configuration review artifact attached for the candidate line.',
  security_review: 'CodeQL and security review artifacts attached.',
  rollback_plan: 'docs/ops/production-deployment.md#upgrade-and-migration-playbook',
  operator_signoff: {
    name: 'Release Manager',
    role: 'platform operator',
    approved_at: '2026-06-03T00:00:00Z',
    notes: 'Beta candidate signoff only.',
  },
  artifact_files: {
    runtime_slo: runtimeSloPath,
  },
  pbx_evidence: {
    feature_codes: {
      status: 'implemented',
      run_url: 'https://github.com/gokbilge/manageCallAI/actions/runs/6',
      artifact: 'artifacts/pbx/feature-codes.json',
    },
    call_parking: {
      status: 'implemented',
      run_url: 'https://github.com/gokbilge/manageCallAI/actions/runs/7',
      artifact: 'artifacts/pbx/call-parking.json',
    },
    conferencing: {
      status: 'implemented',
      run_url: 'https://github.com/gokbilge/manageCallAI/actions/runs/8',
      artifact: 'artifacts/pbx/conferencing.json',
    },
    gateway_reload: {
      status: 'implemented',
      run_url: 'https://github.com/gokbilge/manageCallAI/actions/runs/9',
      artifact: 'artifacts/pbx/gateway-reload.json',
    },
    self_service: {
      status: 'implemented',
      run_url: 'https://github.com/gokbilge/manageCallAI/actions/runs/10',
      artifact: 'artifacts/pbx/self-service.json',
    },
    runtime_management: {
      status: 'implemented',
      run_url: 'https://github.com/gokbilge/manageCallAI/actions/runs/11',
      artifact: 'artifacts/pbx/runtime-management.json',
    },
  },
};

test('--check-config exits 0', () => {
  const result = run(['--check-config']);
  strictEqual(result.status, 0);
  ok(result.stdout.includes('passed'));
});

test('valid beta manifest passes', () => {
  const path = writeTmp('valid-beta.json', validBetaManifest);
  const result = run([`--manifest=${path}`]);
  strictEqual(result.status, 0, result.stderr);
  ok(result.stdout.includes('passed'));
});

test('production manifest rejects placeholder language', () => {
  const path = writeTmp('bad-production-placeholder.json', {
    ...validBetaManifest,
    release_version: 'v0.2.0',
    stage: 'production',
    notes: 'Production release bundle. Remaining production-only gates are tracked in production_gate_status.',
    operator_signoff: {
      name: 'Release Manager',
      role: 'platform operator',
      approved_at: '2026-06-03T00:00:00Z',
      notes: 'Production signoff after separate operator signoff.',
    },
    github_release: {
      tag: 'v0.2.0',
      url: 'https://github.com/gokbilge/manageCallAI/releases/tag/v0.2.0',
      published_at: '2026-06-03T00:00:00Z',
      is_prerelease: false,
    },
  });
  const result = run([`--manifest=${path}`]);
  strictEqual(result.status, 1);
  ok(result.stderr.includes('placeholder'));
});

test('production manifest rejects prerelease GitHub release metadata', () => {
  const path = writeTmp('bad-production-prerelease.json', {
    ...validBetaManifest,
    release_version: 'v0.2.0',
    stage: 'production',
    notes: 'Production release bundle with all evidence attached.',
    operator_signoff: {
      name: 'Release Manager',
      role: 'platform operator',
      approved_at: '2026-06-03T00:00:00Z',
    },
    github_release: {
      tag: 'v0.2.0',
      url: 'https://github.com/gokbilge/manageCallAI/releases/tag/v0.2.0',
      published_at: '2026-06-03T00:00:00Z',
      is_prerelease: true,
    },
  });
  const result = run([`--manifest=${path}`]);
  strictEqual(result.status, 1);
  ok(result.stderr.includes('full GitHub release'));
});

test('valid production manifest passes', () => {
  const path = writeTmp('valid-production.json', {
    ...validBetaManifest,
    release_version: 'v0.2.0',
    stage: 'production',
    notes: 'Production release bundle with all evidence attached.',
    production_preflight: 'Sanitized production preflight artifact attached.',
    production_e2e: 'RC-bound FreeSWITCH smoke artifact attached.',
    production_soak: 'RC-topology soak artifact attached.',
    production_slo: 'RC-topology SLO artifact attached.',
    restore_smoke: 'RC restore rehearsal artifact attached.',
    rate_limit_topology: 'Multi-instance Redis topology artifact attached.',
    log_redaction: 'Sanitized redaction artifact attached.',
    rotation_rehearsal: 'Rotation rehearsal artifact attached.',
    network_config: 'Target network configuration artifact attached.',
    security_review: 'Security review and CodeQL artifacts attached.',
    operator_signoff: {
      name: 'Release Manager',
      role: 'platform operator',
      approved_at: '2026-06-03T00:00:00Z',
    },
    github_release: {
      tag: 'v0.2.0',
      url: 'https://github.com/gokbilge/manageCallAI/releases/tag/v0.2.0',
      published_at: '2026-06-03T00:00:00Z',
      is_prerelease: false,
    },
  });
  const result = run([`--manifest=${path}`]);
  strictEqual(result.status, 0, result.stderr);
  ok(result.stdout.includes('passed'));
});
