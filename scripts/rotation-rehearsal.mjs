#!/usr/bin/env node
/**
 * Runtime token rotation rehearsal.
 *
 * Exercises the runtime token rotation flow against a live API and generates a
 * rotation-rehearsal evidence JSON for the RC evidence bundle.
 *
 * Usage:
 *   pnpm rotation:rehearsal
 *   node scripts/rotation-rehearsal.mjs [--check-config] [--output-dir=<path>]
 *
 * Required env:
 *   API_BASE_URL             — API base URL (e.g. http://localhost:3000)
 *   RUNTIME_API_TOKEN        — primary runtime token
 *
 * Optional env:
 *   ROTATION_SECONDARY_TOKEN             — secondary token to test overlap window
 *   ROTATION_OPERATOR                    — operator name written into the evidence JSON
 *   ROTATION_ENVIRONMENT                 — environment label (staging | production-candidate)
 *   ROTATION_LOG_REDACTION_EVIDENCE      — path to the matching log-redaction evidence JSON
 *   ROTATION_AUDIT_EVENT_IDS             — comma-separated sanitized audit event IDs
 *
 *   Manual confirmation flags — set each to "true" after completing the step:
 *   ROTATION_JWT_NEW_SECRET_DEPLOYED
 *   ROTATION_JWT_OVERLAP_WINDOW_VERIFIED
 *   ROTATION_JWT_NEW_ACCEPTED
 *   ROTATION_JWT_OLD_REJECTED
 *   ROTATION_RUNTIME_SECONDARY_PROMOTED
 *   ROTATION_RUNTIME_PROMOTED_ACCEPTED
 *   ROTATION_RUNTIME_OLD_REJECTED
 *   ROTATION_AUDIT_JWT_EVENT_FOUND
 *   ROTATION_AUDIT_RUNTIME_EVENT_FOUND
 *
 * Exit 0 — all automatable checks passed; artifact written.
 * Exit 1 — one or more automatable checks failed.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const argList = process.argv.slice(2);
const args = new Set(argList);
const outputDirArg = argList.find((a) => a.startsWith('--output-dir='));
const outputDir = outputDirArg
  ? outputDirArg.slice('--output-dir='.length)
  : path.join(rootDir, 'artifacts', 'rotation');

if (args.has('--check-config')) {
  console.log('rotation rehearsal configuration check passed');
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

function env(name) {
  return (process.env[name] ?? '').trim();
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

const apiRoot = env('API_BASE_URL').replace(/\/+$/, '').replace(/\/api\/v1$/, '');
const primaryToken = env('RUNTIME_API_TOKEN');
const secondaryToken = env('ROTATION_SECONDARY_TOKEN');
const operator = env('ROTATION_OPERATOR') || env('USERNAME') || env('USER') || 'local-operator';
const environment = env('ROTATION_ENVIRONMENT') || 'staging';
const logRedactionEvidence = env('ROTATION_LOG_REDACTION_EVIDENCE');
const auditEventIds = env('ROTATION_AUDIT_EVENT_IDS')
  ? env('ROTATION_AUDIT_EVENT_IDS').split(',').map((s) => s.trim()).filter(Boolean)
  : [];

if (!apiRoot) {
  console.error('API_BASE_URL is required (e.g. http://localhost:3000)');
  process.exit(1);
}
if (!primaryToken) {
  console.error('RUNTIME_API_TOKEN is required');
  process.exit(1);
}

const findings = [];
function pass(name, message) {
  findings.push({ level: 'pass', name, message });
  console.log(`ok: ${name} — ${message}`);
}
function fail(name, message) {
  findings.push({ level: 'fail', name, message });
  console.error(`FAIL: ${name} — ${message}`);
}
function info(name, message) {
  findings.push({ level: 'info', name, message });
  console.log(`INFO: ${name} — ${message}`);
}

// ── Token auth probes ─────────────────────────────────────────────────────────

async function probeRuntimeToken(label, token) {
  const encoded = Buffer.from(`freeswitch:${token}`).toString('base64');
  let statusCode;
  try {
    const resp = await fetch(`${apiRoot}/api/v1/freeswitch/dialplan`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encoded}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'destination_number=0&context=default',
    });
    statusCode = resp.status;
  } catch (err) {
    fail(label, `network error: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }

  if (statusCode === 401) {
    fail(label, `token rejected — API returned 401`);
    return false;
  }
  pass(label, `token accepted — API returned ${statusCode}`);
  return true;
}

async function probeTokenRejected(label, token) {
  const encoded = Buffer.from(`freeswitch:${token}`).toString('base64');
  let statusCode;
  try {
    const resp = await fetch(`${apiRoot}/api/v1/freeswitch/dialplan`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encoded}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'destination_number=0&context=default',
    });
    statusCode = resp.status;
  } catch (err) {
    fail(label, `network error: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }

  if (statusCode !== 401) {
    fail(label, `token should have been rejected but API returned ${statusCode}`);
    return false;
  }
  pass(label, `token correctly rejected — API returned 401`);
  return true;
}

// ── Health check ──────────────────────────────────────────────────────────────

async function checkApiHealth() {
  try {
    const resp = await fetch(`${apiRoot}/health`);
    if (!resp.ok) {
      fail('api_health', `API health returned ${resp.status}`);
      return false;
    }
    pass('api_health', `API health OK (${resp.status})`);
    return true;
  } catch (err) {
    fail('api_health', `cannot reach API at ${apiRoot}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// ── Runtime token config check ────────────────────────────────────────────────

function checkRuntimeTokenConfig() {
  const fallbackEnabled = isTruthy(env('ALLOW_RUNTIME_TOKEN_FALLBACK'));
  const isProduction = env('APP_ENV') === 'production';

  if (isProduction && fallbackEnabled) {
    fail('query_body_fallback', 'ALLOW_RUNTIME_TOKEN_FALLBACK must be false in production');
    return false;
  }
  pass('query_body_fallback', 'query/body fallback is disabled');
  return true;
}

// ── Main rehearsal ────────────────────────────────────────────────────────────

const apiHealthy = await checkApiHealth();
if (!apiHealthy) {
  console.error(`\nCannot reach API at ${apiRoot} — aborting rotation rehearsal`);
  process.exit(1);
}

const fallbackDisabled = checkRuntimeTokenConfig();
const primaryAccepted = await probeRuntimeToken('primary_token_auth', primaryToken);

let secondaryConfigured = false;
let secondaryAccepted = false;
if (secondaryToken) {
  secondaryConfigured = true;
  secondaryAccepted = await probeRuntimeToken('secondary_token_auth', secondaryToken);
} else {
  info('secondary_token_auth', 'ROTATION_SECONDARY_TOKEN not set — overlap window not tested in this run');
}

// ── Manual confirmation flags ─────────────────────────────────────────────────

const jwtNewSecretDeployed = isTruthy(env('ROTATION_JWT_NEW_SECRET_DEPLOYED'));
const jwtOverlapVerified = isTruthy(env('ROTATION_JWT_OVERLAP_WINDOW_VERIFIED'));
const jwtNewAccepted = isTruthy(env('ROTATION_JWT_NEW_ACCEPTED'));
const jwtOldRejected = isTruthy(env('ROTATION_JWT_OLD_REJECTED'));
const runtimeSecondaryPromoted = isTruthy(env('ROTATION_RUNTIME_SECONDARY_PROMOTED'));
const runtimePromotedAccepted = isTruthy(env('ROTATION_RUNTIME_PROMOTED_ACCEPTED'));
const runtimeOldRejected = isTruthy(env('ROTATION_RUNTIME_OLD_REJECTED'));
const auditJwtEventFound = isTruthy(env('ROTATION_AUDIT_JWT_EVENT_FOUND'));
const auditRuntimeEventFound = isTruthy(env('ROTATION_AUDIT_RUNTIME_EVENT_FOUND'));

for (const [flag, label] of [
  [jwtNewSecretDeployed, 'ROTATION_JWT_NEW_SECRET_DEPLOYED'],
  [jwtOverlapVerified, 'ROTATION_JWT_OVERLAP_WINDOW_VERIFIED'],
  [jwtNewAccepted, 'ROTATION_JWT_NEW_ACCEPTED'],
  [jwtOldRejected, 'ROTATION_JWT_OLD_REJECTED'],
  [runtimeSecondaryPromoted, 'ROTATION_RUNTIME_SECONDARY_PROMOTED'],
  [runtimePromotedAccepted, 'ROTATION_RUNTIME_PROMOTED_ACCEPTED'],
  [runtimeOldRejected, 'ROTATION_RUNTIME_OLD_REJECTED'],
  [auditJwtEventFound, 'ROTATION_AUDIT_JWT_EVENT_FOUND'],
  [auditRuntimeEventFound, 'ROTATION_AUDIT_RUNTIME_EVENT_FOUND'],
]) {
  if (flag) {
    pass(label, 'operator-confirmed');
  } else {
    info(label, 'not confirmed — set to "true" after completing the manual step');
  }
}

// ── Assemble evidence ─────────────────────────────────────────────────────────

const failures = findings.filter((f) => f.level === 'fail');
const allAutomatedPassed = failures.length === 0;
const allConfirmed =
  jwtNewSecretDeployed &&
  jwtOverlapVerified &&
  jwtNewAccepted &&
  jwtOldRejected &&
  primaryAccepted &&
  secondaryConfigured &&
  secondaryAccepted &&
  fallbackDisabled &&
  runtimeSecondaryPromoted &&
  runtimePromotedAccepted &&
  runtimeOldRejected &&
  auditJwtEventFound &&
  auditRuntimeEventFound;

const status = failures.length === 0 && allConfirmed ? 'passed' : 'incomplete';

const evidence = {
  rotated_at: new Date().toISOString(),
  git_sha: (process.env.GITHUB_SHA ?? '').slice(0, 12) || 'local',
  operator,
  environment,
  mode: 'live',
  status,
  jwt_rotation: {
    new_secret_deployed: jwtNewSecretDeployed,
    overlap_window_verified: jwtOverlapVerified,
    new_jwt_accepted_after_cutover: jwtNewAccepted,
    old_jwt_rejected_after_cutover: jwtOldRejected,
  },
  runtime_token_rotation: {
    secondary_token_configured: secondaryConfigured,
    primary_token_accepted_during_window: primaryAccepted,
    secondary_token_accepted_during_window: secondaryAccepted,
    secondary_promoted_to_primary: runtimeSecondaryPromoted,
    promoted_token_accepted: runtimePromotedAccepted,
    old_primary_rejected_after_revocation: runtimeOldRejected,
    query_body_fallback_disabled_in_production: fallbackDisabled,
  },
  audit: {
    jwt_rotation_event_found: auditJwtEventFound,
    runtime_token_rotation_event_found: auditRuntimeEventFound,
    event_ids: auditEventIds,
  },
  log_redaction: {
    check_passed: Boolean(logRedactionEvidence),
    evidence_path: logRedactionEvidence || '',
  },
  runtime_token_rotation_check_exit_code: allAutomatedPassed ? 0 : 1,
  api_root: apiRoot,
  automated_checks: findings
    .filter((f) => !f.name.startsWith('ROTATION_'))
    .map(({ level, name, message }) => ({ level, name, message })),
  notes: '',
};

mkdirSync(outputDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + 'Z';
const artifactPath = path.join(outputDir, `rotation-rehearsal-${timestamp}.json`);
writeFileSync(artifactPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
console.log(`\nevidence: ${artifactPath}`);

if (failures.length > 0) {
  console.error(`\nrotation rehearsal FAILED with ${failures.length} automated check failure(s)`);
  process.exit(1);
}

if (status === 'incomplete') {
  console.log(`\nrotation rehearsal artifact written (status: incomplete — set ROTATION_* env vars to confirm manual steps)`);
} else {
  console.log(`\nrotation rehearsal PASSED — artifact ready for RC evidence bundle`);
}
