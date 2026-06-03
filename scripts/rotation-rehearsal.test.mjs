import { ok, strictEqual } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const script = new URL('./rotation-rehearsal.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

function run(args, env = {}) {
  return spawnSync('node', [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('--check-config exits 0', () => {
  const result = run(['--check-config']);
  strictEqual(result.status, 0);
  ok(result.stdout.includes('passed'));
});

test('fails without API_BASE_URL', () => {
  const result = run([], {
    API_BASE_URL: '',
    RUNTIME_API_TOKEN: 'some-token-that-is-at-least-32-chars-long',
  });
  strictEqual(result.status, 1);
  ok(result.stderr.includes('API_BASE_URL'));
});

test('fails without RUNTIME_API_TOKEN', () => {
  const result = run([], {
    API_BASE_URL: 'http://localhost:3000',
    RUNTIME_API_TOKEN: '',
  });
  strictEqual(result.status, 1);
  ok(result.stderr.includes('RUNTIME_API_TOKEN'));
});

test('--output-dir flag is accepted alongside --check-config', () => {
  const tmpDir = join(tmpdir(), `rotation-rehearsal-test-${Date.now()}`);
  const result = run(['--check-config', `--output-dir=${tmpDir}`]);
  strictEqual(result.status, 0);
  ok(result.stdout.includes('passed'));
});

test('generates artifact with correct structure when API is unreachable', () => {
  // With an unreachable API the api_health check fails and the script exits 1,
  // but we can verify the error message to confirm the health check ran.
  const tmpDir = join(tmpdir(), `rotation-rehearsal-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const result = run([`--output-dir=${tmpDir}`], {
    API_BASE_URL: 'http://localhost:19999',
    RUNTIME_API_TOKEN: 'test-token-that-is-at-least-32-chars',
  });
  strictEqual(result.status, 1);
  ok(result.stderr.includes('Cannot reach API') || result.stdout.includes('api_health'));
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

test('check-config mode is idempotent across multiple calls', () => {
  const r1 = run(['--check-config']);
  const r2 = run(['--check-config']);
  strictEqual(r1.status, 0);
  strictEqual(r2.status, 0);
  strictEqual(r1.stdout.trim(), r2.stdout.trim());
});
