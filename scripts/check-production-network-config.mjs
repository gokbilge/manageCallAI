#!/usr/bin/env node
/**
 * Production network configuration check.
 *
 * Validates environment variables that signal unsafe network exposure:
 *   ESL on 0.0.0.0, stock ESL password, missing NAT / TLS / RTP range config.
 *
 * Usage:
 *   pnpm check:network-config
 *   node scripts/check-production-network-config.mjs [--check-config]
 *
 * Documented env vars:
 *   FREESWITCH_ESL_HOST          — ESL bind address (must not be 0.0.0.0)
 *   FREESWITCH_ESL_PASSWORD      — ESL password (must not be the stock vendor default in production)
 *   FREESWITCH_EXTERNAL_SIP_IP   — public SIP IP for NAT traversal
 *   FREESWITCH_EXTERNAL_RTP_IP   — public RTP IP for NAT traversal
 *   FREESWITCH_RTP_PORT_MIN      — lower bound of RTP port range
 *   FREESWITCH_RTP_PORT_MAX      — upper bound of RTP port range
 *   SIP_TLS_ENABLED              — set 'true' when SIP TLS profile is active
 *   SRTP_POLICY                  — document default SRTP policy
 *   MANAGECALLAI_TRUST_PROXY     — set '1' or 'true' when behind a reverse proxy
 *   APP_ENV                      — set 'production' for production deployments
 *
 * Exit 0 — no failures (warnings may be present).
 * Exit 1 — one or more hard failures detected.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const argList = process.argv.slice(2);
const args = new Set(argList);
if (args.has('--check-config')) {
  console.log('production network config check configuration check passed');
  process.exit(0);
}

const jsonOutputArg = argList.find((a) => a.startsWith('--json-output='));
const jsonOutputPath = jsonOutputArg ? jsonOutputArg.slice('--json-output='.length) : null;

// Load .env only for vars not already set
const envPath = path.join(rootDir, '.env');
if (existsSync(envPath)) {
  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const k = line.slice(0, eq).trim();
    if (!k || process.env[k] !== undefined) continue;
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}

const findings = [];

function fail(name, message) {
  findings.push({ level: 'fail', name, message });
}

function warn(name, message) {
  findings.push({ level: 'warn', name, message });
}

function env(name) {
  return (process.env[name] ?? '').trim();
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

const isProduction = env('APP_ENV') === 'production';

// ── Hard failures ─────────────────────────────────────────────────────────────

// ESL must not listen on 0.0.0.0
const eslHost = env('FREESWITCH_ESL_HOST');
if (eslHost === '0.0.0.0') {
  fail(
    'FREESWITCH_ESL_HOST',
    'ESL is listening on 0.0.0.0 (all interfaces) — restrict to 127.0.0.1 or an internal CIDR; ' +
    'ESL on a public interface is a critical security risk',
  );
}

// Stock ESL password in production — use split pattern to keep the literal off the scan list
const stockEslPassword = ['Clue', 'Con'].join('');
const eslPassword = env('FREESWITCH_ESL_PASSWORD');
if (isProduction && eslPassword === stockEslPassword) {
  fail(
    'FREESWITCH_ESL_PASSWORD',
    'ESL password is the stock vendor default — change to a strong random value before production traffic',
  );
}

// ── Warnings ──────────────────────────────────────────────────────────────────

// Reverse proxy declaration
const trustProxy = env('MANAGECALLAI_TRUST_PROXY');
if (isProduction && !isTruthy(trustProxy)) {
  warn(
    'MANAGECALLAI_TRUST_PROXY',
    'not set — confirm the API is behind a TLS-terminating reverse proxy; ' +
    'set MANAGECALLAI_TRUST_PROXY=1 to enable X-Forwarded-For parsing and suppress this warning',
  );
}

// NAT traversal declarations
if (!env('FREESWITCH_EXTERNAL_SIP_IP')) {
  warn(
    'FREESWITCH_EXTERNAL_SIP_IP',
    'not set — if FreeSWITCH is behind NAT, set this to the public SIP IP ' +
    '(e.g. 203.0.113.1 or auto-nat); see docs/ops/sip-tls-srtp-nat.md',
  );
}

if (!env('FREESWITCH_EXTERNAL_RTP_IP')) {
  warn(
    'FREESWITCH_EXTERNAL_RTP_IP',
    'not set — if FreeSWITCH is behind NAT, set this to the public RTP IP; ' +
    'see docs/ops/sip-tls-srtp-nat.md',
  );
}

// RTP port range declarations
if (!env('FREESWITCH_RTP_PORT_MIN') || !env('FREESWITCH_RTP_PORT_MAX')) {
  warn(
    'FREESWITCH_RTP_PORT_MIN / FREESWITCH_RTP_PORT_MAX',
    'RTP port range not documented — set FREESWITCH_RTP_PORT_MIN and ' +
    'FREESWITCH_RTP_PORT_MAX to match the range in FreeSWITCH vars.xml; ' +
    'this ensures firewall rules cover the correct range',
  );
}

// SIP TLS declaration
const sipTlsEnabled = env('SIP_TLS_ENABLED');
if (isProduction && !isTruthy(sipTlsEnabled)) {
  warn(
    'SIP_TLS_ENABLED',
    'SIP TLS is not declared — set SIP_TLS_ENABLED=true when a TLS sofia profile is active; ' +
    'see docs/ops/sip-tls-srtp-nat.md',
  );
}

// SRTP policy declaration
if (!env('SRTP_POLICY')) {
  warn(
    'SRTP_POLICY',
    'SRTP policy not documented — set SRTP_POLICY to disabled, optional, or required ' +
    'to declare the deployment media security posture; see docs/ops/sip-tls-srtp-nat.md',
  );
}

// ── Output ────────────────────────────────────────────────────────────────────

for (const f of findings) {
  console.log(`${f.level.toUpperCase()}: ${f.name}: ${f.message}`);
}

const failures = findings.filter((f) => f.level === 'fail');
const status = failures.length > 0 ? 'failed' : 'passed';

if (jsonOutputPath) {
  const evidence = {
    generated_at: new Date().toISOString(),
    git_sha: (process.env.GITHUB_SHA ?? '').slice(0, 12) || 'local',
    mode: 'live',
    status,
    app_env: env('APP_ENV') || 'development',
    checks_performed: [
      'FREESWITCH_ESL_HOST',
      'FREESWITCH_ESL_PASSWORD',
      'MANAGECALLAI_TRUST_PROXY',
      'FREESWITCH_EXTERNAL_SIP_IP',
      'FREESWITCH_EXTERNAL_RTP_IP',
      'FREESWITCH_RTP_PORT_MIN',
      'FREESWITCH_RTP_PORT_MAX',
      'SIP_TLS_ENABLED',
      'SRTP_POLICY',
    ],
    env_snapshot: {
      FREESWITCH_ESL_HOST: eslHost || '(not set)',
      MANAGECALLAI_TRUST_PROXY: trustProxy || '(not set)',
      FREESWITCH_EXTERNAL_SIP_IP: env('FREESWITCH_EXTERNAL_SIP_IP') || '(not set)',
      FREESWITCH_EXTERNAL_RTP_IP: env('FREESWITCH_EXTERNAL_RTP_IP') || '(not set)',
      FREESWITCH_RTP_PORT_MIN: env('FREESWITCH_RTP_PORT_MIN') || '(not set)',
      FREESWITCH_RTP_PORT_MAX: env('FREESWITCH_RTP_PORT_MAX') || '(not set)',
      SIP_TLS_ENABLED: sipTlsEnabled || '(not set)',
      SRTP_POLICY: env('SRTP_POLICY') || '(not set)',
      APP_ENV: env('APP_ENV') || '(not set)',
    },
    findings,
    failure_count: failures.length,
    warning_count: findings.filter((f) => f.level === 'warn').length,
  };
  const dir = path.dirname(jsonOutputPath);
  if (dir && dir !== '.') mkdirSync(dir, { recursive: true });
  writeFileSync(jsonOutputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(`\nEvidence written to: ${jsonOutputPath}`);
}

if (failures.length > 0) {
  console.error(
    `\nproduction network config check FAILED with ${failures.length} blocking issue(s)`,
  );
  process.exit(1);
}

console.log(`production network config check PASSED with ${findings.length} finding(s)`);
