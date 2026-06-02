import { ok, strictEqual } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const script = new URL('./check-runtime-token-rotation.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

const validEvidence = {
  rotated_at: '2026-06-02T10:00:00Z',
  git_sha: 'abc123def456',
  operator: 'release-operator',
  environment: 'staging',
  mode: 'live',
  status: 'passed',
  jwt_rotation: {
    new_secret_deployed: true,
    overlap_window_verified: true,
    new_jwt_accepted_after_cutover: true,
    old_jwt_rejected_after_cutover: true,
  },
  runtime_token_rotation: {
    secondary_token_configured: true,
    primary_token_accepted_during_window: true,
    secondary_token_accepted_during_window: true,
    secondary_promoted_to_primary: true,
    promoted_token_accepted: true,
    old_primary_rejected_after_revocation: true,
    query_body_fallback_disabled_in_production: true,
  },
  audit: {
    jwt_rotation_event_found: true,
    runtime_token_rotation_event_found: true,
    event_ids: ['audit-1', 'audit-2'],
  },
  log_redaction: {
    check_passed: true,
    evidence_path: 'artifacts/log-redaction/log-redaction-evidence.json',
  },
  runtime_token_rotation_check_exit_code: 0,
  notes: 'Rotated one staging API node and one FreeSWITCH agent node.',
};

function run(args, env = {}) {
  return spawnSync('node', [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function writeTmp(name, content) {
  const dir = join(tmpdir(), 'runtime-token-rotation-test');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, name);
  writeFileSync(file, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
  return file;
}

test('--check-config exits 0', () => {
  const result = run(['--check-config']);
  strictEqual(result.status, 0);
  ok(result.stdout.includes('passed'));
});

test('environment check passes with strong primary and no secondary', () => {
  const result = run([], {
    APP_ENV: 'production',
    RUNTIME_API_TOKEN: 'runtime-token-that-is-at-least-thirty-two-chars',
    RUNTIME_API_TOKEN_SECONDARY: '',
    ALLOW_RUNTIME_TOKEN_FALLBACK: 'false',
  });
  strictEqual(result.status, 0, result.stderr);
  ok(result.stdout.includes('PASSED'));
});

test('valid rotation evidence passes', () => {
  const evidencePath = writeTmp('valid-rotation-evidence.json', validEvidence);
  const result = run([`--evidence=${evidencePath}`]);
  strictEqual(result.status, 0, result.stderr);
  ok(result.stdout.includes('PASSED'));
});

test('rotation evidence requires old JWT rejection', () => {
  const evidencePath = writeTmp('missing-old-jwt-rejection.json', {
    ...validEvidence,
    jwt_rotation: {
      ...validEvidence.jwt_rotation,
      old_jwt_rejected_after_cutover: false,
    },
  });
  const result = run([`--evidence=${evidencePath}`]);
  strictEqual(result.status, 1);
  ok(result.stdout.includes('jwt_rotation.old_jwt_rejected_after_cutover'));
});

test('rotation evidence requires old runtime token rejection', () => {
  const evidencePath = writeTmp('missing-old-runtime-token-rejection.json', {
    ...validEvidence,
    runtime_token_rotation: {
      ...validEvidence.runtime_token_rotation,
      old_primary_rejected_after_revocation: false,
    },
  });
  const result = run([`--evidence=${evidencePath}`]);
  strictEqual(result.status, 1);
  ok(result.stdout.includes('runtime_token_rotation.old_primary_rejected_after_revocation'));
});

test('rotation evidence rejects raw token material', () => {
  const evidencePath = writeTmp('raw-token-evidence.json', {
    ...validEvidence,
    runtime_token: 'raw-runtime-token-value',
  });
  const result = run([`--evidence=${evidencePath}`]);
  strictEqual(result.status, 1);
  ok(result.stdout.includes('secrets'));
});
