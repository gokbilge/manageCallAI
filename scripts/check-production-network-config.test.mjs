import { ok, strictEqual } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const script = new URL('./check-production-network-config.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

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

test('passes with all vars set in production', () => {
  const result = run([], {
    APP_ENV: 'production',
    FREESWITCH_ESL_HOST: '127.0.0.1',
    FREESWITCH_ESL_PASSWORD: 'strong-random-esl-password',
    MANAGECALLAI_TRUST_PROXY: '1',
    FREESWITCH_EXTERNAL_SIP_IP: '203.0.113.1',
    FREESWITCH_EXTERNAL_RTP_IP: '203.0.113.1',
    FREESWITCH_RTP_PORT_MIN: '16384',
    FREESWITCH_RTP_PORT_MAX: '32768',
    SIP_TLS_ENABLED: 'true',
    SRTP_POLICY: 'optional',
  });
  strictEqual(result.status, 0);
  ok(result.stdout.includes('PASSED'));
});

test('fails when ESL listens on 0.0.0.0', () => {
  const result = run([], {
    FREESWITCH_ESL_HOST: '0.0.0.0',
  });
  strictEqual(result.status, 1);
  ok(result.stdout.includes('FREESWITCH_ESL_HOST'));
});

test('--json-output writes artifact and exits 0 with good config', () => {
  const tmpDir = join(tmpdir(), `network-config-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const outputPath = join(tmpDir, 'network-config.json');

  const result = run([`--json-output=${outputPath}`], {
    APP_ENV: 'production',
    FREESWITCH_ESL_HOST: '127.0.0.1',
    FREESWITCH_ESL_PASSWORD: 'strong-random-esl-password',
    MANAGECALLAI_TRUST_PROXY: '1',
    FREESWITCH_EXTERNAL_SIP_IP: '203.0.113.1',
    FREESWITCH_EXTERNAL_RTP_IP: '203.0.113.1',
    FREESWITCH_RTP_PORT_MIN: '16384',
    FREESWITCH_RTP_PORT_MAX: '32768',
    SIP_TLS_ENABLED: 'true',
    SRTP_POLICY: 'optional',
  });

  strictEqual(result.status, 0);
  ok(existsSync(outputPath), 'artifact file should be created');

  const artifact = JSON.parse(readFileSync(outputPath, 'utf8'));
  ok(artifact.generated_at, 'artifact must have generated_at');
  strictEqual(artifact.status, 'passed');
  strictEqual(artifact.mode, 'live');
  ok(Array.isArray(artifact.findings));
  ok(artifact.env_snapshot && typeof artifact.env_snapshot === 'object');

  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

test('--json-output writes artifact with failed status when ESL is on 0.0.0.0', () => {
  const tmpDir = join(tmpdir(), `network-config-test-fail-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const outputPath = join(tmpDir, 'network-config.json');

  const result = run([`--json-output=${outputPath}`], {
    FREESWITCH_ESL_HOST: '0.0.0.0',
  });

  strictEqual(result.status, 1);
  ok(existsSync(outputPath), 'artifact should be written even on failure');

  const artifact = JSON.parse(readFileSync(outputPath, 'utf8'));
  strictEqual(artifact.status, 'failed');
  ok(artifact.failure_count > 0);

  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

test('warns on missing NAT/TLS/SRTP vars in production without --json-output', () => {
  const result = run([], {
    APP_ENV: 'production',
    FREESWITCH_ESL_HOST: '127.0.0.1',
    FREESWITCH_ESL_PASSWORD: 'strong-random-esl-password',
  });
  strictEqual(result.status, 0);
  ok(result.stdout.includes('WARN'));
});
