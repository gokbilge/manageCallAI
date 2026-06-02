/**
 * Tests for restore-evidence-check.mjs
 * Run with: node --test scripts/restore-evidence-check.test.mjs
 */

import { strictEqual, ok } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const script = new URL('./restore-evidence-check.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

function run(args, env = {}) {
  return spawnSync('node', [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function writeTmp(name, content) {
  const dir = join(tmpdir(), 'restore-evidence-test');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(content, null, 2));
  return path;
}

const validEvidence = {
  restored_at: '2026-06-01T14:00:00Z',
  database_url_masked: 'postgres://managecallai:***@localhost:5432/managecallai',
  operator: 'Release Manager',
  migration_count: 42,
  tables_verified: ['tenants', 'users', 'extensions'],
  restore_smoke_passed: true,
  db_contracts_passed: true,
  db_constraints_passed: true,
};

const validRcEvidence = {
  ...validEvidence,
  release_version: 'v0.2.0-rc.1',
  commit_sha: '0123456789abcdef0123456789abcdef01234567',
  workflow_run_url: 'https://github.com/gokbilge/manageCallAI/actions/runs/123456789',
  target_host: 'enlogy@10.0.0.32',
  source_backup_file: 'managecallai-20260602.pgdump',
  backup_taken_at: '2026-06-01T13:55:00Z',
  node_version: 'v22.0.0',
  pnpm_version: '10.0.0',
  postgres_version: 'psql (PostgreSQL) 16.0',
  api_image_tag: '0123456789abcdef0123456789abcdef01234567',
  environment: 'rc',
};

test('--check-config exits 0', () => {
  const result = run(['--check-config']);
  strictEqual(result.status, 0);
  ok(result.stdout.includes('passed'));
});

test('valid evidence passes', () => {
  const path = writeTmp('valid.json', validEvidence);
  const result = run([`--evidence=${path}`]);
  strictEqual(result.status, 0, result.stderr);
  ok(result.stdout.includes('PASSED'));
});

test('valid RC evidence passes with --require-rc', () => {
  const path = writeTmp('valid-rc.json', validRcEvidence);
  const result = run([`--evidence=${path}`, '--require-rc']);
  strictEqual(result.status, 0, result.stderr);
  ok(result.stdout.includes('PASSED'));
});

test('--require-rc fails when release metadata is missing', () => {
  const path = writeTmp('missing-rc-metadata.json', validEvidence);
  const result = run([`--evidence=${path}`, '--require-rc']);
  strictEqual(result.status, 1);
  ok(result.stdout.includes('release_version'));
  ok(result.stdout.includes('commit_sha'));
});

test('--require-rc rejects development environment evidence', () => {
  const path = writeTmp('dev-rc.json', { ...validRcEvidence, environment: 'development' });
  const result = run([`--evidence=${path}`, '--require-rc']);
  strictEqual(result.status, 1);
  ok(result.stdout.includes('environment'));
});

test('short commit SHA fails when present', () => {
  const path = writeTmp('short-sha.json', { ...validEvidence, commit_sha: 'abc123' });
  const result = run([`--evidence=${path}`]);
  strictEqual(result.status, 1);
  ok(result.stdout.includes('commit_sha'));
});

test('missing required fields fails', () => {
  const path = writeTmp('missing.json', { ...validEvidence, operator: undefined });
  const result = run([`--evidence=${path}`]);
  strictEqual(result.status, 1);
  ok(result.stdout.includes('FAIL'));
});

test('restore_smoke_passed=false fails', () => {
  const path = writeTmp('smoke-fail.json', { ...validEvidence, restore_smoke_passed: false });
  const result = run([`--evidence=${path}`]);
  strictEqual(result.status, 1);
  ok(result.stdout.includes('restore_smoke_passed'));
});

test('db_contracts_passed=false fails', () => {
  const path = writeTmp('contracts-fail.json', { ...validEvidence, db_contracts_passed: false });
  const result = run([`--evidence=${path}`]);
  strictEqual(result.status, 1);
  ok(result.stdout.includes('db_contracts_passed'));
});

test('db_constraints_passed=false fails', () => {
  const path = writeTmp('constraints-fail.json', { ...validEvidence, db_constraints_passed: false });
  const result = run([`--evidence=${path}`]);
  strictEqual(result.status, 1);
  ok(result.stdout.includes('db_constraints_passed'));
});

test('migration_count=0 fails', () => {
  const path = writeTmp('no-migrations.json', { ...validEvidence, migration_count: 0 });
  const result = run([`--evidence=${path}`]);
  strictEqual(result.status, 1);
  ok(result.stdout.includes('migration_count'));
});

test('empty tables_verified array fails', () => {
  const path = writeTmp('no-tables.json', { ...validEvidence, tables_verified: [] });
  const result = run([`--evidence=${path}`]);
  strictEqual(result.status, 1);
  ok(result.stdout.includes('tables_verified'));
});

test('unmasked database password fails', () => {
  const path = writeTmp('unmasked-pw.json', {
    ...validEvidence,
    database_url_masked: 'postgres://managecallai:supersecretpassword@localhost:5432/managecallai',
  });
  const result = run([`--evidence=${path}`]);
  strictEqual(result.status, 1);
  ok(result.stdout.includes('database_url_masked'));
});

test('malformed restored_at fails', () => {
  const path = writeTmp('bad-date.json', { ...validEvidence, restored_at: 'yesterday' });
  const result = run([`--evidence=${path}`]);
  strictEqual(result.status, 1);
  ok(result.stdout.includes('restored_at'));
});

test('missing evidence file exits 1', () => {
  const result = run(['--evidence=/tmp/does-not-exist-restore-evidence.json']);
  strictEqual(result.status, 1);
  ok(result.stderr.includes('not found'));
});

test('missing --evidence arg exits 1', () => {
  const result = run([]);
  strictEqual(result.status, 1);
  ok(result.stderr.includes('Usage'));
});

test('preflight_passed=false emits warn not fail', () => {
  const path = writeTmp('no-preflight.json', { ...validEvidence, preflight_passed: false });
  const result = run([`--evidence=${path}`]);
  // Should still pass overall (warn only)
  strictEqual(result.status, 0, result.stderr);
  ok(result.stdout.includes('WARN'));
});
