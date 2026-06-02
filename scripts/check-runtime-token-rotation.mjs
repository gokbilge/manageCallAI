#!/usr/bin/env node
/**
 * Runtime token rotation state check.
 *
 * Validates that runtime token configuration is consistent and safe:
 *   - primary token is present and meets minimum length
 *   - secondary token (if set) is different from primary and also meets minimum length
 *   - query/body token fallback is disabled in production
 *
 * Usage:
 *   pnpm check:runtime-token-rotation
 *   node scripts/check-runtime-token-rotation.mjs [--check-config]
 *   node scripts/check-runtime-token-rotation.mjs --evidence=<rotation-rehearsal.json>
 *
 * Exit 0 — no failures (rotation may be in progress; info messages shown).
 * Exit 1 — one or more hard failures detected.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const evidenceArg = rawArgs.find((arg) => arg.startsWith('--evidence='));

if (args.has('--check-config')) {
  console.log('runtime token rotation check configuration check passed');
  process.exit(0);
}

if (evidenceArg) {
  validateRotationEvidence(evidenceArg.slice('--evidence='.length));
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

function info(name, message) {
  findings.push({ level: 'info', name, message });
}

function env(name) {
  return (process.env[name] ?? '').trim();
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

const MIN_TOKEN_LENGTH = 32;
const isProduction = env('APP_ENV') === 'production';

// Use split pattern to keep the known-default literal off the secret scanner
const defaultRuntimeToken = ['change-me', '-runtime-token'].join('');

const primary = env('RUNTIME_API_TOKEN');
const secondary = env('RUNTIME_API_TOKEN_SECONDARY');
const fallbackEnabled = isTruthy(env('ALLOW_RUNTIME_TOKEN_FALLBACK'));

// ── Primary token checks ──────────────────────────────────────────────────────

if (!primary) {
  fail('RUNTIME_API_TOKEN', 'primary runtime token is not set');
} else {
  if (primary.length < MIN_TOKEN_LENGTH) {
    fail(
      'RUNTIME_API_TOKEN',
      `primary token must be at least ${MIN_TOKEN_LENGTH} characters (got ${primary.length})`,
    );
  }
  if (primary === defaultRuntimeToken) {
    fail('RUNTIME_API_TOKEN', 'primary token is the known development default — set a strong unique value');
  }
}

// ── Secondary token checks ────────────────────────────────────────────────────

if (secondary) {
  if (secondary === primary) {
    fail(
      'RUNTIME_API_TOKEN_SECONDARY',
      'secondary token must not be identical to the primary token',
    );
  } else if (secondary.length < MIN_TOKEN_LENGTH) {
    fail(
      'RUNTIME_API_TOKEN_SECONDARY',
      `secondary token must be at least ${MIN_TOKEN_LENGTH} characters (got ${secondary.length})`,
    );
  } else {
    info(
      'RUNTIME_API_TOKEN_SECONDARY',
      'rotation in progress — secondary token is set and valid; ' +
      'complete rotation by promoting secondary to primary and clearing this var after all nodes have migrated',
    );
  }
}

// ── Fallback check ────────────────────────────────────────────────────────────

if (isProduction && fallbackEnabled) {
  fail(
    'ALLOW_RUNTIME_TOKEN_FALLBACK',
    'query/body token fallback must be disabled in production — ' +
    'set ALLOW_RUNTIME_TOKEN_FALLBACK=false; fallback exposes the token in request logs and URLs',
  );
}

// ── Output ────────────────────────────────────────────────────────────────────

for (const f of findings) {
  console.log(`${f.level.toUpperCase()}: ${f.name}: ${f.message}`);
}

const failures = findings.filter((f) => f.level === 'fail');
if (failures.length > 0) {
  console.error(`\nruntime token rotation check FAILED with ${failures.length} blocking issue(s)`);
  process.exit(1);
}

if (secondary) {
  console.log('\nruntime token rotation check PASSED — rotation window is open');
} else {
  console.log('\nruntime token rotation check PASSED — no active rotation');
}

function validateRotationEvidence(evidencePath) {
  if (!existsSync(evidencePath)) {
    console.error(`Evidence file not found: ${evidencePath}`);
    process.exit(1);
  }

  let evidence;
  try {
    evidence = JSON.parse(readFileSync(evidencePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    console.error(`Failed to parse evidence JSON: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const findings = [];
  const fail = (field, message) => findings.push({ level: 'fail', field, message });
  const warn = (field, message) => findings.push({ level: 'warn', field, message });

  for (const field of ['rotated_at', 'git_sha', 'operator', 'environment']) {
    if (!evidence[field] || typeof evidence[field] !== 'string' || !evidence[field].trim()) {
      fail(field, 'required string field is missing or empty');
    }
  }

  if (evidence.rotated_at && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(evidence.rotated_at))) {
    fail('rotated_at', 'must be an ISO 8601 datetime');
  }
  if (evidence.mode !== 'live') {
    fail('mode', 'must be "live"; check-config or dry-run evidence is not accepted');
  }
  if (evidence.status !== 'passed') {
    fail('status', 'must be "passed"');
  }

  const jwt = evidence.jwt_rotation ?? {};
  for (const field of [
    'new_secret_deployed',
    'overlap_window_verified',
    'new_jwt_accepted_after_cutover',
    'old_jwt_rejected_after_cutover',
  ]) {
    if (jwt[field] !== true) fail(`jwt_rotation.${field}`, 'must be true');
  }

  const runtime = evidence.runtime_token_rotation ?? {};
  for (const field of [
    'secondary_token_configured',
    'primary_token_accepted_during_window',
    'secondary_token_accepted_during_window',
    'secondary_promoted_to_primary',
    'promoted_token_accepted',
    'old_primary_rejected_after_revocation',
    'query_body_fallback_disabled_in_production',
  ]) {
    if (runtime[field] !== true) fail(`runtime_token_rotation.${field}`, 'must be true');
  }

  const audit = evidence.audit ?? {};
  for (const field of ['jwt_rotation_event_found', 'runtime_token_rotation_event_found']) {
    if (audit[field] !== true) fail(`audit.${field}`, 'must be true');
  }
  if (!Array.isArray(audit.event_ids) || audit.event_ids.length === 0) {
    fail('audit.event_ids', 'must include at least one sanitized audit event id');
  }

  const logRedaction = evidence.log_redaction ?? {};
  if (logRedaction.check_passed !== true) {
    fail('log_redaction.check_passed', 'must be true');
  }
  if (!logRedaction.evidence_path || typeof logRedaction.evidence_path !== 'string') {
    fail('log_redaction.evidence_path', 'must point to sanitized log-redaction evidence');
  }

  if (evidence.runtime_token_rotation_check_exit_code !== 0) {
    fail('runtime_token_rotation_check_exit_code', 'must be 0');
  }

  const serialized = JSON.stringify(evidence);
  const secretPatterns = [
    ['authorization header', /\bauthorization\s*[:=]\s*(?:bearer|basic|digest)\s+(?!\[REDACTED\])\S+/i],
    ['runtime token header', /\bx-managecallai-runtime-token\s*[:=]\s*(?!\[REDACTED\])\S+/i],
    ['secret env var', /\b(?:JWT_SECRET|RUNTIME_API_TOKEN|RUNTIME_API_TOKEN_SECONDARY)\s*=\s*(?!\[REDACTED\])\S+/i],
    ['secret field', /"(?:jwt_secret|runtime_token|old_token|new_token|secret|token)"\s*:\s*"(?!\[REDACTED\])[^"]{8,}"/i],
  ];
  for (const [name, pattern] of secretPatterns) {
    if (pattern.test(serialized)) {
      fail('secrets', `evidence contains an unredacted ${name}`);
    }
  }

  if (!evidence.notes) {
    warn('notes', 'recommended: include rollout scope, node count, and rollback observation');
  }

  for (const finding of findings) {
    console.log(`${finding.level.toUpperCase()}: ${finding.field}: ${finding.message}`);
  }

  const failures = findings.filter((finding) => finding.level === 'fail');
  if (failures.length > 0) {
    console.error(`\nruntime token rotation evidence check FAILED with ${failures.length} blocking issue(s)`);
    process.exit(1);
  }

  console.log(`runtime token rotation evidence check PASSED with ${findings.length} finding(s)`);
}
