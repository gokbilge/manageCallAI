#!/usr/bin/env node

const args = new Set(process.argv.slice(2));
const checkConfigOnly = args.has('--check-config');
const stockEslPassword = ['Clue', 'Con'].join('');

const findings = [];

function env(name) {
  return process.env[name] ?? '';
}

function fail(name, message) {
  findings.push({ level: 'fail', name, message });
}

function warn(name, message) {
  findings.push({ level: 'warn', name, message });
}

function requireValue(name) {
  if (!env(name)) fail(name, 'required value is missing');
}

function rejectSample(name, samples) {
  const value = env(name);
  if (value && samples.includes(value)) fail(name, 'value matches a known sample/default');
}

if (checkConfigOnly) {
  console.log('production preflight configuration check passed');
  process.exit(0);
}

for (const name of ['APP_ENV', 'DATABASE_URL', 'JWT_SECRET', 'RUNTIME_API_TOKEN', 'SIP_SECRET_MASTER_KEY', 'SIP_SECRET_KEY_ID']) {
  requireValue(name);
}

if (env('APP_ENV') !== 'production') fail('APP_ENV', 'must be production for production deployments');
if (env('JWT_SECRET').length < 32) fail('JWT_SECRET', 'must be at least 32 characters');
if (env('RUNTIME_API_TOKEN').length < 32) fail('RUNTIME_API_TOKEN', 'must be at least 32 characters');
if (!/^[a-f0-9]{64}$/i.test(env('SIP_SECRET_MASTER_KEY'))) {
  fail('SIP_SECRET_MASTER_KEY', 'must be 64 hex characters');
}

rejectSample('JWT_SECRET', ['ci-jwt-secret', 'test-jwt-secret']);
rejectSample('RUNTIME_API_TOKEN', ['ci-runtime-token', 'test-runtime-token']);
rejectSample('FREESWITCH_ESL_PASSWORD', [stockEslPassword]);

if (/localhost|127\.0\.0\.1/i.test(env('DATABASE_URL'))) {
  warn('DATABASE_URL', 'points at localhost; confirm this is intentional for the production host');
}
if (!env('PLATFORM_OPERATOR_EMAILS')) {
  warn('PLATFORM_OPERATOR_EMAILS', 'no platform operator bootstrap email configured');
}
if (!env('RATE_LIMIT_AUTH_MAX') || !env('RATE_LIMIT_RUNTIME_MAX')) {
  warn('RATE_LIMIT_*', 'explicit production rate-limit values are not set');
}
if (!env('RECORDING_STORAGE_ROOT')) {
  warn('RECORDING_STORAGE_ROOT', 'recording storage root is not configured');
}

// Multi-instance rate limiting gate:
// The in-process limiter is not safe for horizontal scaling. Operators must
// either run one instance, use the built-in Redis shared store, provide another
// external limiter, or enforce limits at the edge.
const instanceCount = Number.parseInt(env('MANAGECALLAI_INSTANCE_COUNT') || '1', 10);
const rateLimitStore = env('RATE_LIMIT_STORE').toLowerCase();
const redisSharedStoreConfigured = rateLimitStore === 'redis' && Boolean(env('RATE_LIMIT_REDIS_URL'));
const externalEnforced =
  ['1', 'true', 'yes'].includes((env('RATE_LIMIT_EXTERNAL_ENFORCED') || '').toLowerCase()) ||
  ['1', 'true', 'yes'].includes((env('EDGE_RATE_LIMIT_ENFORCED') || '').toLowerCase());
if (instanceCount > 1 && !externalEnforced && !redisSharedStoreConfigured) {
  fail(
    'RATE_LIMIT_EXTERNAL_ENFORCED',
    `multi-instance deployment (MANAGECALLAI_INSTANCE_COUNT=${instanceCount}) requires ` +
    'RATE_LIMIT_STORE=redis with RATE_LIMIT_REDIS_URL, another external shared rate limiter, or an ' +
    'edge gateway rate limit (set EDGE_RATE_LIMIT_ENFORCED=true) -- ' +
    'the in-process limiter does not synchronise across instances',
  );
}

if (instanceCount > 1 && rateLimitStore === 'redis' && !env('RATE_LIMIT_REDIS_URL')) {
  fail('RATE_LIMIT_REDIS_URL', 'required when RATE_LIMIT_STORE=redis');
}

// Warn if runtime token fallback is still enabled in production.
if (env('APP_ENV') === 'production' &&
    ['1', 'true', 'yes'].includes((env('ALLOW_RUNTIME_TOKEN_FALLBACK') || '').toLowerCase())) {
  fail('ALLOW_RUNTIME_TOKEN_FALLBACK', 'must be false or unset in production — query/body token fallback exposes the token in request logs and URLs');
}

for (const finding of findings) {
  const label = finding.level.toUpperCase();
  console.log(`${label}: ${finding.name}: ${finding.message}`);
}

const failures = findings.filter((finding) => finding.level === 'fail');
if (failures.length > 0) {
  console.error(`production preflight failed with ${failures.length} blocking issue(s)`);
  process.exit(1);
}

console.log(`production preflight passed with ${findings.length} finding(s)`);
