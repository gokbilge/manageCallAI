#!/usr/bin/env node

const args = new Set(process.argv.slice(2));
const checkConfigOnly = args.has('--check-config');

function env(name) {
  return process.env[name] ?? '';
}

function bool(name) {
  return ['1', 'true', 'yes'].includes(env(name).toLowerCase());
}

function int(name, fallback) {
  const parsed = Number.parseInt(env(name), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

if (checkConfigOnly) {
  console.log('rate-limit topology configuration check passed');
  process.exit(0);
}

const findings = [];
const instanceCount = int('MANAGECALLAI_INSTANCE_COUNT', 1);
const appEnv = env('APP_ENV') || 'development';
const externalEnforced = bool('RATE_LIMIT_EXTERNAL_ENFORCED');
const gatewayEnforced = bool('EDGE_RATE_LIMIT_ENFORCED');
const rateLimitStore = env('RATE_LIMIT_STORE').toLowerCase();
const redisSharedStoreConfigured = rateLimitStore === 'redis' && Boolean(env('RATE_LIMIT_REDIS_URL'));

function fail(name, message) {
  findings.push({ level: 'fail', name, message });
}

function warn(name, message) {
  findings.push({ level: 'warn', name, message });
}

if (appEnv === 'production' && instanceCount > 1 && !externalEnforced && !gatewayEnforced && !redisSharedStoreConfigured) {
  fail(
    'RATE_LIMIT_EXTERNAL_ENFORCED',
    'multi-instance production deployments require RATE_LIMIT_STORE=redis with RATE_LIMIT_REDIS_URL, RATE_LIMIT_EXTERNAL_ENFORCED=true, or EDGE_RATE_LIMIT_ENFORCED=true',
  );
}

for (const name of ['RATE_LIMIT_AUTH_MAX', 'RATE_LIMIT_RUNTIME_MAX', 'RATE_LIMIT_WEBHOOK_MAX', 'RATE_LIMIT_OUTBOUND_MAX']) {
  if (!env(name)) warn(name, 'explicit production limit is not configured');
}

if (appEnv === 'production' && !env('RATE_LIMIT_WINDOW_MS')) {
  warn('RATE_LIMIT_WINDOW_MS', 'explicit production window is not configured');
}

if (appEnv === 'production' && instanceCount > 1 && externalEnforced && !env('RATE_LIMIT_STORE')) {
  warn('RATE_LIMIT_STORE', 'external limiter is marked enforced but the store/provider is not named');
}

if (appEnv === 'production' && instanceCount > 1 && rateLimitStore === 'redis' && !env('RATE_LIMIT_REDIS_URL')) {
  fail('RATE_LIMIT_REDIS_URL', 'RATE_LIMIT_REDIS_URL is required when RATE_LIMIT_STORE=redis');
}

for (const finding of findings) {
  console.log(`${finding.level.toUpperCase()}: ${finding.name}: ${finding.message}`);
}

const failures = findings.filter((finding) => finding.level === 'fail');
if (failures.length > 0) {
  console.error(`rate-limit topology check failed with ${failures.length} blocking issue(s)`);
  process.exit(1);
}

console.log(`rate-limit topology check passed with ${findings.length} finding(s)`);
