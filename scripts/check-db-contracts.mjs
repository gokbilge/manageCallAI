#!/usr/bin/env node
/**
 * DB contract check.
 *
 * Verifies that every column the application code expects is present in the
 * live database after migrations have been applied. Run this after
 * `pnpm db:migrate` to catch migration gaps before tests or deployments.
 *
 * Usage:
 *   node ./scripts/check-db-contracts.mjs
 *   DATABASE_URL=postgres://user:pass@host/db node ./scripts/check-db-contracts.mjs
 *
 * Exit 0  — all required columns present.
 * Exit 1  — one or more columns missing, or connection failure.
 */

import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

// ── Load .env (same approach as db/migrate.mjs) ────────────────────────────────
function loadEnv() {
  for (const candidate of [path.join(rootDir, '.env'), path.join(rootDir, '.env.example')]) {
    if (!existsSync(candidate)) continue;
    for (const rawLine of readFileSync(candidate, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const sep = line.indexOf('=');
      if (sep < 0) continue;
      const key = line.slice(0, sep).trim();
      if (!key || process.env[key] !== undefined) continue;
      let value = line.slice(sep + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
    break;
  }
}
loadEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DB contract check: DATABASE_URL is required');
  process.exit(1);
}

// ── Resolve pg from workspace ──────────────────────────────────────────────────
function resolvePg() {
  for (const base of [rootDir, path.join(rootDir, 'apps', 'api')]) {
    try {
      const resolved = require.resolve('pg', { paths: [base] });
      return require(resolved);
    } catch { /* try next base */ }
  }
  throw new Error('Cannot resolve pg — run pnpm install first');
}

const { Pool } = resolvePg();

// ── Required columns ──────────────────────────────────────────────────────────
// Each entry is [table, column]. Add a new row here whenever the application
// starts reading a newly required column so that CI catches the gap.
const REQUIRED_COLUMNS = [
  // users
  ['users', 'password_hash'],     // 0002_add_user_password
  ['users', 'role'],              // 0018_user_roles
  // tenants
  ['tenants', 'directory_domain'], // 0001_initial_schema (squashed)
  // extensions
  ['extensions', 'sip_password_ciphertext'], // 0001_initial_schema (squashed)
  ['extensions', 'sip_password_key_id'],     // 0001_initial_schema (squashed)
  // ivr_flows
  ['ivr_flows', 'draft_version_id'],  // 0009_add_ivr_flow_sessions
  ['ivr_flows', 'active_version_id'], // 0009_add_ivr_flow_sessions
  // flow_versions
  ['flow_versions', 'state'],          // 0009_add_ivr_flow_sessions
  // audit_events
  ['audit_events', 'actor_type'],      // 0019_tenant_audit_log
  // call_events
  ['call_events', 'call_id'],          // 0001_initial_schema
];

// ── Run check ──────────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: databaseUrl });

try {
  const tables = [...new Set(REQUIRED_COLUMNS.map(([t]) => t))];

  const { rows } = await pool.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = ANY($1)`,
    [tables],
  );

  const present = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));

  const missing = REQUIRED_COLUMNS
    .filter(([t, c]) => !present.has(`${t}.${c}`))
    .map(([t, c]) => `${t}.${c}`);

  if (missing.length > 0) {
    console.error(`\nDB contract check FAILED — ${missing.length} required column(s) not found:\n`);
    for (const col of missing) {
      console.error(`  ✗  ${col}`);
    }
    console.error('\nRun pnpm db:migrate to apply pending migrations, then retry.\n');
    process.exitCode = 1;
  } else {
    console.log(`DB contract check PASSED — ${REQUIRED_COLUMNS.length} required columns verified`);
  }
} catch (err) {
  console.error('DB contract check ERROR:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
