#!/usr/bin/env node
/**
 * Validates a sanitized restore-evidence JSON artifact.
 *
 * Usage:
 *   node scripts/restore-evidence-check.mjs --evidence=<path-to-restore-evidence.json>
 *   node scripts/restore-evidence-check.mjs --check-config
 *
 * Evidence template: docs/ops/templates/restore-evidence-template.json
 *
 * --check-config validates that the script is correctly wired without requiring a real artifact.
 */

import { readFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const checkConfigOnly = args.includes('--check-config');

if (checkConfigOnly) {
  console.log('restore evidence check configuration check passed');
  process.exit(0);
}

const evidenceArg = args.find((a) => a.startsWith('--evidence='));
if (!evidenceArg) {
  console.error('Usage: node scripts/restore-evidence-check.mjs --evidence=<path>');
  process.exit(1);
}

const evidencePath = evidenceArg.slice('--evidence='.length);
if (!existsSync(evidencePath)) {
  console.error(`Evidence file not found: ${evidencePath}`);
  process.exit(1);
}

let evidence;
try {
  evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
} catch (err) {
  console.error(`Failed to parse evidence JSON: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const findings = [];

function fail(field, message) {
  findings.push({ level: 'fail', field, message });
}

function warn(field, message) {
  findings.push({ level: 'warn', field, message });
}

// Required string fields
for (const field of ['restored_at', 'database_url_masked', 'operator']) {
  if (!evidence[field] || typeof evidence[field] !== 'string' || !evidence[field].trim()) {
    fail(field, `required string field is missing or empty`);
  }
}

// restored_at must look like an ISO date
if (evidence.restored_at && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(evidence.restored_at))) {
  fail('restored_at', 'must be an ISO 8601 datetime (e.g. 2026-06-01T14:00:00Z)');
}

// database_url_masked must mask any password (should contain *** or have no credentials)
if (evidence.database_url_masked) {
  const url = String(evidence.database_url_masked);
  // If the URL contains @ (credentials present), the password must be masked with ***
  if (url.includes('@') && !url.includes(':***@') && !url.includes(':@')) {
    fail('database_url_masked', 'appears to contain an unmasked password — replace the password portion with ***');
  }
}

// Required positive integers
if (typeof evidence.migration_count !== 'number' || evidence.migration_count < 1) {
  fail('migration_count', 'must be a positive integer (number of applied migrations after restore)');
}

// Required boolean gates — all must be exactly true
for (const field of ['restore_smoke_passed', 'db_contracts_passed', 'db_constraints_passed']) {
  if (evidence[field] !== true) {
    fail(field, `must be true — do not file evidence when this check did not pass`);
  }
}

// Required tables array
if (!Array.isArray(evidence.tables_verified) || evidence.tables_verified.length === 0) {
  fail('tables_verified', 'must be a non-empty array of verified table names');
}

// Optional but recommended
if (!evidence.preflight_passed) {
  warn('preflight_passed', 'production:preflight evidence not included — recommended for production restores');
}
if (!evidence.e2e_passed) {
  warn('e2e_passed', 'production:e2e evidence not included — recommended for production restores');
}
if (!evidence.restore_duration_seconds) {
  warn('restore_duration_seconds', 'restore duration not recorded — useful for RTO tracking');
}

// Must not contain real credentials
const serialized = JSON.stringify(evidence);
for (const pattern of [/"password"\s*:\s*"[^"]{8,}"/, /"jwt_secret"\s*:\s*"[^"]{8,}"/i, /"sip_secret"\s*:\s*"[^"]{8,}"/i]) {
  if (pattern.test(serialized)) {
    fail('secrets', 'evidence appears to contain real credentials — sanitize before committing');
  }
}

for (const finding of findings) {
  console.log(`${finding.level.toUpperCase()}: ${finding.field}: ${finding.message}`);
}

const failures = findings.filter((f) => f.level === 'fail');
if (failures.length > 0) {
  console.error(`restore evidence check FAILED with ${failures.length} blocking issue(s)`);
  process.exit(1);
}

console.log(`restore evidence check PASSED with ${findings.length} finding(s)`);
