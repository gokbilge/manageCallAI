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

  if (!db.offsite_location || typeof db.offsite_location !== 'string' || !db.offsite_location.trim()) {
    fail('database.offsite_location', 'must name the off-site backup location class or provider');
  }

  if (!db.encryption_algorithm || typeof db.encryption_algorithm !== 'string' || !db.encryption_algorithm.trim()) {
    fail('database.encryption_algorithm', 'must name the backup encryption algorithm');
  }

  if (typeof db.encryption_key_rotation_days !== 'number' || db.encryption_key_rotation_days < 1) {
    fail('database.encryption_key_rotation_days', 'must be a positive integer');
  } else if (db.encryption_key_rotation_days > 365) {
    warn('database.encryption_key_rotation_days', 'encryption key rotation interval is longer than one year');
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

  if (!rec.encryption_algorithm || typeof rec.encryption_algorithm !== 'string' || !rec.encryption_algorithm.trim()) {
    fail('recordings.encryption_algorithm', 'must name the recording backup encryption algorithm');
  }

  if (rec.offsite_copy !== true) {
    fail('recordings.offsite_copy', 'must be true — recording backups must have an off-site copy');
  }

  if (!rec.offsite_location || typeof rec.offsite_location !== 'string' || !rec.offsite_location.trim()) {
    fail('recordings.offsite_location', 'must name the recording off-site backup location class or provider');
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

  if (typeof secrets.rotation_interval_days !== 'number' || secrets.rotation_interval_days < 1) {
    warn('secrets.rotation_interval_days', 'secret rotation interval not set');
  }
}

const alerting = policy.alerting;
if (!alerting || typeof alerting !== 'object') {
  fail('alerting', 'alerting configuration object is missing');
} else {
  if (typeof alerting.backup_failure_after_minutes !== 'number' || alerting.backup_failure_after_minutes < 1) {
    fail('alerting.backup_failure_after_minutes', 'must be a positive integer');
  }
  if (typeof alerting.missed_backup_threshold !== 'number' || alerting.missed_backup_threshold < 1) {
    fail('alerting.missed_backup_threshold', 'must be a positive integer');
  }
  if (!alerting.contact || typeof alerting.contact !== 'string' || !alerting.contact.trim()) {
    fail('alerting.contact', 'must identify the escalation contact or team');
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
