#!/usr/bin/env node
/**
 * Validates a production-runtime-e2e evidence JSON artifact.
 *
 * Usage:
 *   node scripts/check-runtime-e2e-evidence.mjs --evidence=<path>
 *   node scripts/check-runtime-e2e-evidence.mjs --dir=<evidence-dir>
 *   node scripts/check-runtime-e2e-evidence.mjs --check-config
 *   node scripts/check-runtime-e2e-evidence.mjs --help
 *
 * When --dir is provided, the script selects the most recent
 * production-runtime-e2e-*.json file in that directory.
 *
 * Exit 0 = evidence is valid and all required steps passed.
 * Exit 1 = evidence is missing, invalid, or contains failures.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const REQUIRED_STEPS = [
  'api health',
  'tenant registration and login',
  'extension create',
  'freeswitch directory lookup',
  'ivr flow draft create',
  'ivr validate and simulate',
  'ivr publish lifecycle',
  'inbound route validate and publish',
  'freeswitch dialplan lookup',
  'ivr runtime session start',
  'runtime event ingest and tenant query',
];

// Patterns that suggest an unredacted secret ended up in the evidence file.
const SECRET_PATTERNS = [
  /\b(eyJ[A-Za-z0-9_-]{10,})\b/,          // JWT (base64url header)
  /\bBearer\s+[A-Za-z0-9_\-.]{16,}\b/i,    // Bearer token
  /\bClueCon\b/,                             // ESL vendor default
  /SIP_SECRET_MASTER_KEY\s*=\s*[0-9a-f]{64}/i,
  /RUNTIME_API_TOKEN\s*=\s*\S{16,}/i,
];

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
check-runtime-e2e-evidence.mjs — validates a production runtime E2E evidence artifact

Usage:
  node scripts/check-runtime-e2e-evidence.mjs --evidence=<path>    validate specific file
  node scripts/check-runtime-e2e-evidence.mjs --dir=<directory>    validate latest file in dir
  node scripts/check-runtime-e2e-evidence.mjs --check-config       verify script is wired
  node scripts/check-runtime-e2e-evidence.mjs --help               show this message

Required fields:  status, mode, git_sha, generated_at, steps[]
Required status:  "passed"
Required mode:    "live"
Required steps:   ${REQUIRED_STEPS.join(', ')}

Exit 0 = valid. Exit 1 = invalid or failed.
`);
  process.exit(0);
}

if (args.includes('--check-config')) {
  console.log('check-runtime-e2e-evidence configuration check passed');
  process.exit(0);
}

// ── Resolve evidence path ───────────────────────────────────────────────────

let evidencePath;

const evidenceArg = args.find((a) => a.startsWith('--evidence='));
const dirArg = args.find((a) => a.startsWith('--dir='));

if (evidenceArg) {
  evidencePath = evidenceArg.slice('--evidence='.length);
} else if (dirArg) {
  const dir = dirArg.slice('--dir='.length);
  if (!existsSync(dir)) {
    console.error(`Evidence directory not found: ${dir}`);
    process.exit(1);
  }
  const files = readdirSync(dir)
    .filter((f) => /^production-runtime-e2e-.+\.json$/.test(f))
    .sort()
    .reverse();
  if (files.length === 0) {
    console.error(`No production-runtime-e2e-*.json files found in: ${dir}`);
    process.exit(1);
  }
  evidencePath = join(dir, files[0]);
  console.log(`Using latest evidence file: ${evidencePath}`);
} else {
  console.error('Usage: --evidence=<path> or --dir=<directory>');
  console.error('Run with --help for full usage.');
  process.exit(1);
}

if (!existsSync(evidencePath)) {
  console.error(`Evidence file not found: ${evidencePath}`);
  process.exit(1);
}

// ── Parse ───────────────────────────────────────────────────────────────────

let evidence;
try {
  evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
} catch (err) {
  console.error(`Failed to parse evidence JSON: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

// ── Validate ────────────────────────────────────────────────────────────────

const failures = [];
const warnings = [];

function fail(msg) { failures.push(msg); }
function warn(msg) { warnings.push(msg); }

// mode must be "live" — reject check-config runs
if (!evidence.mode) {
  fail('evidence.mode is missing');
} else if (evidence.mode !== 'live') {
  fail(`evidence.mode must be "live", got "${evidence.mode}" — check-config and dry-run artifacts are not valid release evidence`);
}

// status must be "passed"
if (!evidence.status) {
  fail('evidence.status is missing');
} else if (evidence.status !== 'passed') {
  fail(`evidence.status must be "passed", got "${evidence.status}"`);
}

// git_sha must exist
if (!evidence.git_sha) {
  fail('evidence.git_sha is missing');
}

// generated_at must exist and look like an ISO datetime
if (!evidence.generated_at) {
  fail('evidence.generated_at is missing');
} else if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(evidence.generated_at))) {
  fail('evidence.generated_at must be an ISO 8601 datetime');
}

// steps must be an array
if (!Array.isArray(evidence.steps)) {
  fail('evidence.steps must be an array');
} else {
  const passedStepNames = new Set(
    evidence.steps
      .filter((s) => s && s.status === 'passed')
      .map((s) => String(s.name).toLowerCase()),
  );

  for (const required of REQUIRED_STEPS) {
    if (!passedStepNames.has(required.toLowerCase())) {
      // Check if the step exists but failed
      const anyStep = evidence.steps.find((s) => String(s.name).toLowerCase() === required.toLowerCase());
      if (anyStep) {
        fail(`required step "${required}" has status "${anyStep.status}" (expected "passed")`);
      } else {
        fail(`required step "${required}" is missing from evidence`);
      }
    }
  }
}

// Check for obvious unredacted secrets
const serialized = JSON.stringify(evidence);
for (const pattern of SECRET_PATTERNS) {
  if (pattern.test(serialized)) {
    fail(`evidence appears to contain an unredacted secret matching ${pattern} — pipe output through scripts/redact-logs.mjs before saving`);
  }
}

// Warnings
if (!evidence.api_root) {
  warn('evidence.api_root is not recorded');
}

// ── Summary ─────────────────────────────────────────────────────────────────

console.log(`\nevidence file : ${evidencePath}`);
console.log(`mode          : ${evidence.mode ?? '(missing)'}`);
console.log(`status        : ${evidence.status ?? '(missing)'}`);
console.log(`git_sha       : ${evidence.git_sha ?? '(missing)'}`);
console.log(`generated_at  : ${evidence.generated_at ?? '(missing)'}`);
console.log(`steps found   : ${Array.isArray(evidence.steps) ? evidence.steps.length : 0}`);

for (const w of warnings) {
  console.log(`WARN: ${w}`);
}

if (failures.length > 0) {
  console.error(`\ncheck-runtime-e2e-evidence FAILED (${failures.length} issue(s)):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log(`\ncheck-runtime-e2e-evidence PASSED — all ${REQUIRED_STEPS.length} required steps verified`);
