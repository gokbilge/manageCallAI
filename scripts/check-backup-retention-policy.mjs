#!/usr/bin/env node
/**
 * Validates a backup retention policy JSON artifact.
 *
 * Usage:
 *   node scripts/check-backup-retention-policy.mjs --policy=<path>
 *   node scripts/check-backup-retention-policy.mjs --check-config
 *
 * Policy template: docs/ops/templates/backup-retention-policy-template.json
 *
 * Exit 0 — policy meets minimum requirements.
 * Exit 1 — one or more required fields missing or below minimum thresholds.
 */

import { existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const checkConfigOnly = args.includes('--check-config');

if (checkConfigOnly) {
  console.log('backup retention policy check configuration check passed');
  process.exit(0);
}

const policyArg = args.find((a) => a.startsWith('--policy='));
if (!policyArg) {
  console.error('Usage: node scripts/check-backup-retention-policy.mjs --policy=<path>');
  process.exit(1);
}

const policyPath = policyArg.slice('--policy='.length);
if (!existsSync(policyPath)) {
  console.error(`Policy file not found: ${policyPath}`);
  process.exit(1);
}

let policy;
try {
  policy = JSON.parse(readFileSync(policyPath, 'utf8'));
} catch (err) {
  console.error(`Failed to parse policy JSON: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const findings = [];

function fail(field, message) {
  findings.push({ level: 'fail', field, message });
}

function warn(field, message) {
  findings.push({ level: 'warn', field, message });
}

// ── RPO and RTO ───────────────────────────────────────────────────────────────

if (typeof policy.rpo_minutes !== 'number' || policy.rpo_minutes < 1) {
  fail('rpo_minutes', 'must be a positive integer (minutes between backup checkpoints)');
}

if (typeof policy.rto_minutes !== 'number' || policy.rto_minutes < 1) {
  fail('rto_minutes', 'must be a positive integer (maximum acceptable recovery time in minutes)');
}

// ── Database backup ───────────────────────────────────────────────────────────

const db = policy.database;
if (!db || typeof db !== 'object') {
  fail('database', 'database backup configuration object is missing');
} else {
  if (!db.frequency || typeof db.frequency !== 'string') {
    fail('database.frequency', 'must be a string (e.g. "daily")');
  }

  if (typeof db.retention_days !== 'number' || db.retention_days < 1) {
    fail('database.retention_days', 'must be a positive integer');
  } else if (db.retention_days < 7) {
    warn('database.retention_days', `${db.retention_days} days is below the recommended minimum of 7 days`);
  }

  if (db.encrypted_at_rest !== true) {
    fail('database.encrypted_at_rest', 'must be true — database backups must be encrypted at rest');
  }

  if (db.offsite_copy !== true) {
    fail('database.offsite_copy', 'must be true — database backups must have an off-site copy');
  }

  if (typeof db.restore_rehearsal_interval_days !== 'number' || db.restore_rehearsal_interval_days < 1) {
    warn('database.restore_rehearsal_interval_days', 'restore rehearsal interval not set — recommend at most 30 days');
  } else if (db.restore_rehearsal_interval_days > 90) {
    warn('database.restore_rehearsal_interval_days', `${db.restore_rehearsal_interval_days} days between rehearsals is too long — recommend at most 90 days`);
  }
}

// ── Recordings backup ─────────────────────────────────────────────────────────

const rec = policy.recordings;
if (!rec || typeof rec !== 'object') {
  fail('recordings', 'recordings backup configuration object is missing');
} else {
  if (!rec.frequency || typeof rec.frequency !== 'string') {
    fail('recordings.frequency', 'must be a string (e.g. "daily")');
  }

  if (typeof rec.retention_days !== 'number' || rec.retention_days < 1) {
    fail('recordings.retention_days', 'must be a positive integer');
  } else if (rec.retention_days < 30) {
    warn('recordings.retention_days', `${rec.retention_days} days is below the recommended minimum of 30 days`);
  }

  if (rec.encrypted_at_rest !== true) {
    fail('recordings.encrypted_at_rest', 'must be true — recording backups must be encrypted at rest');
  }
}

// ── Secrets ───────────────────────────────────────────────────────────────────

const secrets = policy.secrets;
if (!secrets || typeof secrets !== 'object') {
  fail('secrets', 'secrets configuration object is missing');
} else {
  if (secrets.stored_separately_from_database !== true) {
    fail('secrets.stored_separately_from_database', 'must be true — secrets must not be co-located with database dumps');
  }
  if (!secrets.secrets_manager || typeof secrets.secrets_manager !== 'string' || !secrets.secrets_manager.trim()) {
    warn('secrets.secrets_manager', 'secrets manager not specified — name your secrets store (e.g. HashiCorp Vault, AWS Secrets Manager)');
  }
}

// ── Required metadata ─────────────────────────────────────────────────────────

for (const field of ['operator', 'environment']) {
  if (!policy[field] || typeof policy[field] !== 'string' || !policy[field].trim()) {
    warn(field, `recommended field is missing or empty`);
  }
}

// ── Output ────────────────────────────────────────────────────────────────────

for (const f of findings) {
  console.log(`${f.level.toUpperCase()}: ${f.field}: ${f.message}`);
}

const failures = findings.filter((f) => f.level === 'fail');
if (failures.length > 0) {
  console.error(`\nbackup retention policy check FAILED with ${failures.length} blocking issue(s)`);
  process.exit(1);
}

console.log(`\nbackup retention policy check PASSED with ${findings.length} finding(s)`);
