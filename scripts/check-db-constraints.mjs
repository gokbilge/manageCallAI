#!/usr/bin/env node
/**
 * DB constraint and default check.
 *
 * Verifies structural invariants that go beyond column existence:
 *   - column defaults (e.g. users.role DEFAULT 'tenant_admin')
 *   - CHECK constraints (e.g. users_role_check)
 *   - UNIQUE constraints / indexes (e.g. idempotency_records)
 *   - partial unique indexes (e.g. inbound_routes_active_unique_match)
 *   - immutability rules on audit tables
 *   - foreign-key presence for critical cross-table relationships
 *   - DLQ / event_id columns on webhook_delivery_queue
 *
 * Run this after `pnpm db:migrate` to catch constraint gaps before tests.
 *
 * Usage:
 *   node scripts/check-db-constraints.mjs
 *   DATABASE_URL=postgres://... node scripts/check-db-constraints.mjs
 *
 * Exit 0 — all checks pass.
 * Exit 1 — one or more checks fail or connection error.
 */

import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dir, '..');
const require = createRequire(import.meta.url);

// ── Env loader ────────────────────────────────────────────────────────────────
function loadEnv() {
  for (const candidate of [path.join(rootDir, '.env'), path.join(rootDir, '.env.example')]) {
    if (!existsSync(candidate)) continue;
    for (const raw of readFileSync(candidate, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const sep = line.indexOf('=');
      if (sep < 0) continue;
      const key = line.slice(0, sep).trim();
      if (!key || process.env[key] !== undefined) continue;
      let val = line.slice(sep + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
    break;
  }
}
loadEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('check-db-constraints: DATABASE_URL is required');
  process.exit(1);
}

function resolvePg() {
  for (const base of [rootDir, path.join(rootDir, 'apps', 'api')]) {
    try { return require(require.resolve('pg', { paths: [base] })); } catch { /* try next */ }
  }
  throw new Error('Cannot resolve pg — run pnpm install first');
}
const { Pool } = resolvePg();
const pool = new Pool({ connectionString: databaseUrl });

// ── Check registry ────────────────────────────────────────────────────────────

const failures = [];
const passed = [];

function ok(label) { passed.push(label); }
function fail(label, detail) { failures.push({ label, detail }); }

// ── Query helpers ─────────────────────────────────────────────────────────────

async function columnDefault(table, column) {
  const { rows } = await pool.query(
    `SELECT column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return rows[0]?.column_default ?? null;
}

async function columnNullable(table, column) {
  const { rows } = await pool.query(
    `SELECT is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return rows[0]?.is_nullable === 'YES';
}

async function checkConstraintExists(table, constraintName) {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.table_constraints
     WHERE table_schema = 'public'
       AND table_name = $1
       AND constraint_name = $2
       AND constraint_type = 'CHECK'`,
    [table, constraintName],
  );
  return rows.length > 0;
}

async function uniqueConstraintExists(table, constraintName) {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.table_constraints
     WHERE table_schema = 'public'
       AND table_name = $1
       AND constraint_name = $2
       AND constraint_type = 'UNIQUE'`,
    [table, constraintName],
  );
  return rows.length > 0;
}

async function indexExists(indexName) {
  const { rows } = await pool.query(
    `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1`,
    [indexName],
  );
  return rows.length > 0;
}

async function ruleExists(tableName, ruleName) {
  const { rows } = await pool.query(
    `SELECT 1 FROM pg_rules
     WHERE schemaname = 'public' AND tablename = $1 AND rulename = $2`,
    [tableName, ruleName],
  );
  return rows.length > 0;
}

async function foreignKeyExists(fromTable, fromColumn, toTable) {
  const { rows } = await pool.query(
    `SELECT 1
     FROM information_schema.referential_constraints rc
     JOIN information_schema.key_column_usage kcu
       ON kcu.constraint_name = rc.constraint_name
      AND kcu.constraint_schema = rc.constraint_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = rc.unique_constraint_name
      AND ccu.constraint_schema = rc.constraint_schema
     WHERE rc.constraint_schema = 'public'
       AND kcu.table_name = $1
       AND kcu.column_name = $2
       AND ccu.table_name = $3`,
    [fromTable, fromColumn, toTable],
  );
  return rows.length > 0;
}

async function columnExists(table, column) {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return rows.length > 0;
}

// ── Run all checks ────────────────────────────────────────────────────────────

try {

  // ── 1. users.role column default and NOT NULL ──────────────────────────────
  {
    const def = await columnDefault('users', 'role');
    if (def && def.includes('tenant_admin')) {
      ok('users.role DEFAULT includes tenant_admin');
    } else {
      fail('users.role DEFAULT', `Expected default containing 'tenant_admin', got: ${def ?? 'NULL'}`);
    }

    const nullable = await columnNullable('users', 'role');
    if (!nullable) {
      ok('users.role is NOT NULL');
    } else {
      fail('users.role NOT NULL', 'Column is nullable — role must always be set');
    }
  }

  // ── 2. users_role_check CHECK constraint ──────────────────────────────────
  {
    const exists = await checkConstraintExists('users', 'users_role_check');
    if (exists) {
      ok('users_role_check CHECK constraint exists');
    } else {
      fail('users_role_check', 'CHECK constraint not found on users table (migration 0018)');
    }
  }

  // ── 3. idempotency_records UNIQUE (tenant_id, idempotency_key) ────────────
  // The constraint was created inline in the CREATE TABLE; its generated name
  // matches the pattern idempotency_records_tenant_id_idempotency_key_key.
  // We check both named constraint and a partial unique index fallback.
  {
    const constraintName = 'idempotency_records_tenant_id_idempotency_key_key';
    const hasConstraint = await uniqueConstraintExists('idempotency_records', constraintName);
    const hasIndex = await indexExists(constraintName);
    if (hasConstraint || hasIndex) {
      ok('idempotency_records UNIQUE(tenant_id, idempotency_key) exists');
    } else {
      fail(
        'idempotency_records unique constraint',
        `Neither UNIQUE constraint nor index "${constraintName}" found (migration 0032)`,
      );
    }
  }

  // ── 4. audit_events immutability rules ─────────────────────────────────────
  for (const rule of ['audit_events_no_update', 'audit_events_no_delete']) {
    const exists = await ruleExists('audit_events', rule);
    if (exists) {
      ok(`audit_events immutability rule: ${rule}`);
    } else {
      fail(`audit_events immutability: ${rule}`, `Rule not found (migration 0028)`);
    }
  }

  // ── 5. tenant_audit_log immutability rules ─────────────────────────────────
  for (const rule of ['tenant_audit_log_no_update', 'tenant_audit_log_no_delete']) {
    const exists = await ruleExists('tenant_audit_log', rule);
    if (exists) {
      ok(`tenant_audit_log immutability rule: ${rule}`);
    } else {
      fail(`tenant_audit_log immutability: ${rule}`, `Rule not found (migration 0028)`);
    }
  }

  // ── 6. inbound_routes_active_unique_match partial index ───────────────────
  {
    const exists = await indexExists('inbound_routes_active_unique_match');
    if (exists) {
      ok('inbound_routes_active_unique_match partial index exists');
    } else {
      fail(
        'inbound_routes_active_unique_match',
        'Partial unique index not found (migration 0007). Active-route uniqueness is unenforced.',
      );
    }
  }

  // ── 7. webhook_delivery_queue DLQ columns ──────────────────────────────────
  for (const col of ['event_id', 'abandoned_at', 'dismissed_at', 'dismiss_reason']) {
    const exists = await columnExists('webhook_delivery_queue', col);
    if (exists) {
      ok(`webhook_delivery_queue.${col} exists`);
    } else {
      fail(`webhook_delivery_queue.${col}`, `Column missing (migration 0031)`);
    }
  }

  // ── 8. webhook_delivery_queue event_id uniqueness index ───────────────────
  {
    const exists = await indexExists('webhook_delivery_queue_event_id_unique');
    if (exists) {
      ok('webhook_delivery_queue_event_id_unique index exists');
    } else {
      fail(
        'webhook_delivery_queue_event_id_unique',
        'Partial unique index on (webhook_id, event_id) not found (migration 0031)',
      );
    }
  }

  // ── 9. Critical foreign keys ───────────────────────────────────────────────
  const criticalFKs = [
    { from: 'extensions', col: 'tenant_id', to: 'tenants', migration: '0001' },
    { from: 'sip_trunks', col: 'tenant_id', to: 'tenants', migration: '0001' },
    { from: 'phone_numbers', col: 'tenant_id', to: 'tenants', migration: '0001' },
    { from: 'inbound_routes', col: 'tenant_id', to: 'tenants', migration: '0001' },
    { from: 'ivr_flows', col: 'tenant_id', to: 'tenants', migration: '0009' },
    { from: 'flow_versions', col: 'flow_id', to: 'ivr_flows', migration: '0009' },
    { from: 'audit_events', col: 'tenant_id', to: 'tenants', migration: '0019' },
    { from: 'approval_requests', col: 'tenant_id', to: 'tenants', migration: '0023' },
    { from: 'idempotency_records', col: 'tenant_id', to: 'tenants', migration: '0032' },
    { from: 'ivr_flow_sessions', col: 'flow_id', to: 'ivr_flows', migration: '0009' },
    { from: 'webhook_delivery_queue', col: 'tenant_id', to: 'tenants', migration: '0023' },
  ];

  for (const { from, col, to, migration } of criticalFKs) {
    const exists = await foreignKeyExists(from, col, to);
    if (exists) {
      ok(`FK: ${from}.${col} → ${to}`);
    } else {
      fail(`FK: ${from}.${col} → ${to}`, `Foreign key missing (migration ${migration})`);
    }
  }

  // ── 10. sip_trunks.srtp_policy column exists (latest migration) ───────────
  {
    const exists = await columnExists('sip_trunks', 'srtp_policy');
    if (exists) {
      ok('sip_trunks.srtp_policy column exists');
    } else {
      fail('sip_trunks.srtp_policy', 'Column missing (migration 0037)');
    }
  }

} catch (err) {
  console.error('check-db-constraints ERROR:', err instanceof Error ? err.message : err);
  await pool.end().catch(() => {});
  process.exit(1);
}

await pool.end().catch(() => {});

// ── Report ─────────────────────────────────────────────────────────────────────

const total = passed.length + failures.length;

if (failures.length > 0) {
  console.error(`\ncheck-db-constraints FAILED — ${failures.length} of ${total} checks failed:\n`);
  for (const { label, detail } of failures) {
    console.error(`  ✗  ${label}`);
    console.error(`       ${detail}`);
  }
  console.error('');
  console.error('Run pnpm db:migrate to apply pending migrations, then retry.\n');
  process.exitCode = 1;
} else {
  console.log(`check-db-constraints PASSED — ${total} checks verified`);
}
