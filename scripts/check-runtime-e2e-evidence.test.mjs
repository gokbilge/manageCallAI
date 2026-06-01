/**
 * Tests for check-runtime-e2e-evidence.mjs
 * Run with: node --test scripts/check-runtime-e2e-evidence.test.mjs
 */

import { strictEqual, ok } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const script = new URL('./check-runtime-e2e-evidence.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

function run(args) {
  return spawnSync('node', [script, ...args], { encoding: 'utf8' });
}

function writeTmp(name, content) {
  const dir = join(tmpdir(), 'runtime-e2e-evidence-test');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(content, null, 2));
  return path;
}

const allPassedSteps = [
  { name: 'api health', status: 'passed' },
  { name: 'tenant registration and login', status: 'passed' },
  { name: 'extension create', status: 'passed' },
  { name: 'freeswitch directory lookup', status: 'passed' },
  { name: 'ivr flow draft create', status: 'passed' },
  { name: 'ivr validate and simulate', status: 'passed' },
  { name: 'ivr publish lifecycle', status: 'passed' },
  { name: 'inbound route validate and publish', status: 'passed' },
  { name: 'freeswitch dialplan lookup', status: 'passed' },
  { name: 'ivr runtime session start', status: 'passed' },
  { name: 'runtime event ingest and tenant query', status: 'passed' },
];

const validEvidence = {
  status: 'passed',
  mode: 'live',
  git_sha: 'abc123def456',
  generated_at: '2026-06-01T14:00:00Z',
  api_root: 'http://localhost:3000',
  steps: allPassedSteps,
};

test('--check-config exits 0', () => {
  const r = run(['--check-config']);
  strictEqual(r.status, 0);
  ok(r.stdout.includes('passed'));
});

test('--help exits 0', () => {
  const r = run(['--help']);
  strictEqual(r.status, 0);
  ok(r.stdout.includes('Usage'));
});

test('valid evidence passes', () => {
  const path = writeTmp('valid.json', validEvidence);
  const r = run([`--evidence=${path}`]);
  strictEqual(r.status, 0, r.stderr);
  ok(r.stdout.includes('PASSED'));
});

test('missing evidence file exits 1', () => {
  const r = run(['--evidence=/tmp/does-not-exist-runtime-e2e.json']);
  strictEqual(r.status, 1);
  ok(r.stderr.includes('not found'));
});

test('no args exits 1', () => {
  const r = run([]);
  strictEqual(r.status, 1);
  ok(r.stderr.includes('Usage'));
});

test('mode=check-config fails', () => {
  const path = writeTmp('check-config.json', { ...validEvidence, mode: 'check-config' });
  const r = run([`--evidence=${path}`]);
  strictEqual(r.status, 1);
  ok(r.stderr.includes('mode'));
});

test('status=failed fails', () => {
  const path = writeTmp('status-fail.json', { ...validEvidence, status: 'failed' });
  const r = run([`--evidence=${path}`]);
  strictEqual(r.status, 1);
  ok(r.stderr.includes('status'));
});

test('missing git_sha fails', () => {
  const path = writeTmp('no-sha.json', { ...validEvidence, git_sha: undefined });
  const r = run([`--evidence=${path}`]);
  strictEqual(r.status, 1);
  ok(r.stderr.includes('git_sha'));
});

test('missing generated_at fails', () => {
  const path = writeTmp('no-ts.json', { ...validEvidence, generated_at: undefined });
  const r = run([`--evidence=${path}`]);
  strictEqual(r.status, 1);
  ok(r.stderr.includes('generated_at'));
});

test('missing required step fails', () => {
  const steps = allPassedSteps.filter((s) => s.name !== 'freeswitch directory lookup');
  const path = writeTmp('missing-step.json', { ...validEvidence, steps });
  const r = run([`--evidence=${path}`]);
  strictEqual(r.status, 1);
  ok(r.stderr.includes('freeswitch directory lookup'));
});

test('step with status=failed fails', () => {
  const steps = allPassedSteps.map((s) =>
    s.name === 'ivr validate and simulate' ? { ...s, status: 'failed' } : s,
  );
  const path = writeTmp('step-fail.json', { ...validEvidence, steps });
  const r = run([`--evidence=${path}`]);
  strictEqual(r.status, 1);
  ok(r.stderr.includes('ivr validate and simulate'));
});

test('evidence with ClueCon ESL password fails', () => {
  const path = writeTmp('esl-secret.json', {
    ...validEvidence,
    _debug: 'FREESWITCH_ESL_PASSWORD=ClueCon',
  });
  const r = run([`--evidence=${path}`]);
  strictEqual(r.status, 1);
  ok(r.stderr.includes('unredacted secret'));
});

test('evidence with Bearer token fails', () => {
  const fakeToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0In0.xyz';
  const path = writeTmp('bearer-token.json', {
    ...validEvidence,
    _debug: fakeToken,
  });
  const r = run([`--evidence=${path}`]);
  strictEqual(r.status, 1);
  ok(r.stderr.includes('unredacted secret'));
});

test('--dir finds latest evidence file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'runtime-e2e-dir-'));
  const name = `production-runtime-e2e-2026-06-01T14-00-00-000Z.json`;
  writeFileSync(join(dir, name), JSON.stringify(validEvidence, null, 2));
  const r = run([`--dir=${dir}`]);
  strictEqual(r.status, 0, r.stderr);
  ok(r.stdout.includes('PASSED'));
});

test('--dir with no matching files exits 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'runtime-e2e-empty-'));
  const r = run([`--dir=${dir}`]);
  strictEqual(r.status, 1);
  ok(r.stderr.includes('No production-runtime-e2e'));
});
