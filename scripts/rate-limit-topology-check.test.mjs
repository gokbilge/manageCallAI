import { ok, strictEqual } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const script = new URL('./rate-limit-topology-check.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

function run(env = {}) {
  return spawnSync('node', [script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      APP_ENV: 'production',
      MANAGECALLAI_INSTANCE_COUNT: '2',
      RATE_LIMIT_AUTH_MAX: '100',
      RATE_LIMIT_RUNTIME_MAX: '1200',
      RATE_LIMIT_WEBHOOK_MAX: '300',
      RATE_LIMIT_OUTBOUND_MAX: '60',
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_EXTERNAL_ENFORCED: '',
      EDGE_RATE_LIMIT_ENFORCED: '',
      RATE_LIMIT_STORE: '',
      RATE_LIMIT_REDIS_URL: '',
      ...env,
    },
  });
}

test('multi-instance production fails without shared, external, or edge rate limiting', () => {
  const result = run();
  strictEqual(result.status, 1);
  ok(result.stdout.includes('RATE_LIMIT_EXTERNAL_ENFORCED'));
});

test('multi-instance production passes with Redis shared store configured', () => {
  const result = run({
    RATE_LIMIT_STORE: 'redis',
    RATE_LIMIT_REDIS_URL: 'redis://localhost:6379/0',
  });
  strictEqual(result.status, 0, result.stderr);
  ok(result.stdout.includes('passed'));
});

test('multi-instance production fails when Redis store has no URL', () => {
  const result = run({ RATE_LIMIT_STORE: 'redis' });
  strictEqual(result.status, 1);
  ok(result.stdout.includes('RATE_LIMIT_REDIS_URL'));
});
