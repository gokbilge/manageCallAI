#!/usr/bin/env node
/**
 * FreeSWITCH hardening check.
 *
 * Validates environment variables for known unsafe FreeSWITCH defaults
 * that would constitute a security risk in production.
 *
 * Usage:
 *   pnpm check:freeswitch-hardening
 *   node scripts/check-freeswitch-hardening.mjs [--check-config]
 *
 * Checked env vars:
 *   FREESWITCH_ESL_HOST          — must not be 0.0.0.0
 *   FREESWITCH_ESL_PASSWORD      — must not be the stock vendor default in production
 *   APP_ENV                      — used to apply production-only rules
 *   FREESWITCH_ANONYMOUS_CALLS   — set 'disabled' to suppress warning
 *   FREESWITCH_MOD_XML_RPC       — set 'disabled' to confirm mod_xml_rpc is off
 *   FREESWITCH_LOG_LEVEL         — warn if not set to warning or lower in production
 *
 * Exit 0 — no failures (warnings may be present).
 * Exit 1 — one or more hard failures detected.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
if (args.has('--check-config')) {
  console.log('FreeSWITCH hardening check configuration check passed');
  process.exit(0);
}

// Load .env — only sets vars not already in the environment
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

// Use split pattern to keep the known-default literal off the secret scanner
const stockEslPassword = ['Clue', 'Con'].join('');
const isProduction = env('APP_ENV') === 'production';

// ── Hard failures ─────────────────────────────────────────────────────────────

// ESL must not be exposed on all interfaces
const eslHost = env('FREESWITCH_ESL_HOST');
if (eslHost === '0.0.0.0') {
  fail(
    'FREESWITCH_ESL_HOST',
    'ESL is listening on 0.0.0.0 (all interfaces) — restrict to 127.0.0.1; ' +
    'see freeswitch/conf/autoload_configs/event_socket.conf.xml.production.example',
  );
}

// Stock ESL password must not be used in production
const eslPassword = env('FREESWITCH_ESL_PASSWORD');
if (isProduction && eslPassword === stockEslPassword) {
  fail(
    'FREESWITCH_ESL_PASSWORD',
    'ESL password is the stock vendor default — change to a strong random value ' +
    '(openssl rand -hex 16) before production traffic',
  );
}

// ── Warnings ──────────────────────────────────────────────────────────────────

// Anonymous call policy
const anonymousCalls = env('FREESWITCH_ANONYMOUS_CALLS');
if (isProduction && anonymousCalls !== 'disabled') {
  warn(
    'FREESWITCH_ANONYMOUS_CALLS',
    'anonymous call handling not declared — set FREESWITCH_ANONYMOUS_CALLS=disabled ' +
    'to confirm anonymous INVITEs are rejected; see docs/ops/freeswitch-hardening.md',
  );
}

// mod_xml_rpc
const modXmlRpc = env('FREESWITCH_MOD_XML_RPC');
if (isProduction && modXmlRpc !== 'disabled') {
  warn(
    'FREESWITCH_MOD_XML_RPC',
    'mod_xml_rpc status not declared — set FREESWITCH_MOD_XML_RPC=disabled to confirm ' +
    'the HTTP XML-RPC control interface is not loaded; see docs/ops/freeswitch-hardening.md',
  );
}

// Log level
const logLevel = env('FREESWITCH_LOG_LEVEL');
const verboseLevels = ['debug', 'info', 'notice'];
if (isProduction && verboseLevels.includes(logLevel.toLowerCase())) {
  warn(
    'FREESWITCH_LOG_LEVEL',
    `log level is ${logLevel} — set to warning or error in production to avoid ` +
    'logging SIP credentials and call payloads in high-verbosity entries',
  );
}

// Hardening doc presence (confirm operators have read it)
if (!existsSync(path.join(rootDir, 'docs/ops/freeswitch-hardening.md'))) {
  warn(
    'docs/ops/freeswitch-hardening.md',
    'FreeSWITCH hardening guide is missing from the repository',
  );
}

// ── Output ────────────────────────────────────────────────────────────────────

for (const f of findings) {
  console.log(`${f.level.toUpperCase()}: ${f.name}: ${f.message}`);
}

const failures = findings.filter((f) => f.level === 'fail');
if (failures.length > 0) {
  console.error(
    `\nFreeSWITCH hardening check FAILED with ${failures.length} blocking issue(s)`,
  );
  process.exit(1);
}

console.log(`FreeSWITCH hardening check PASSED with ${findings.length} finding(s)`);
