#!/usr/bin/env node
/**
 * Public schema boundary guard.
 *
 * Scans every SQL file in db/migrations/ for table names that belong
 * exclusively in private commercial or enterprise modules. Fails CI if any
 * are found, preventing accidental leakage of private schema into the public
 * repo.
 *
 * Rules:
 *   - Blocked patterns must not appear in any CREATE TABLE statement in a
 *     public migration file.
 *   - The existing entitlement foundation tables (migration 0077) are
 *     explicitly allowed and are excluded from triggering false positives.
 *   - Only the CREATE TABLE token is scanned to avoid false matches in
 *     comments that reference blocked terms for documentation purposes.
 *
 * Usage:
 *   node scripts/check-public-schema-boundary.mjs
 *   node scripts/check-public-schema-boundary.mjs --verbose
 *
 * Exit 0 — all checks pass.
 * Exit 1 — one or more violations found.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dir, '..', 'db', 'migrations');
const verbose = process.argv.includes('--verbose');

// ── Blocked table name substrings ────────────────────────────────────────────
//
// Any CREATE TABLE statement whose table name contains one of these substrings
// is a violation. Matches are case-insensitive and strip schema prefixes so
// that "managecallai_commercial.invoice" also matches "invoice".
//
// Full rationale: docs/commercial/private-schema-extension-policy.md

const BLOCKED_PATTERNS = [
  // License lifecycle
  'license_activation',
  'license_revocation',
  'license_generator',
  'activation_nonce',
  'signing_key_record',

  // Commercial agreements and billing
  'customer_contract',
  'invoice',
  'invoice_line',
  'subscription_billing',
  'billing_event',
  'reseller_billing',
  'reseller_account',
  'partner_margin',
  'paid_add_on',
  'add_on_purchase',
  'channel_partner',

  // Identity federation
  'sso_connection',
  'saml_metadata',
  'saml_config',
  'oidc_client',
  'oidc_config',
  'identity_provider',
  'federated_identity',

  // Enterprise migration intelligence
  'migration_project',
  'migration_job',
  'migration_batch',
  'cucm_import',
  'avaya_import',
  'alcatel_import',
  'cisco_uccx_import',
  'pbx_import',
  'compatibility_score',
  'migration_intelligence',

  // Enterprise analytics and export
  'compliance_export',
  'legal_hold',
  'enterprise_audit_export',
  'retention_policy_export',
  'data_export_job',

  // HA deployment and infrastructure
  'ha_node',
  'deployment_instance',
  'cluster_registry',
  'carrier_certification',
  'private_module_registry',

  // Support and SLA
  'support_contract',
  'support_ticket',
  'sla_tier',
  'escalation_record',
];

// ── Explicitly allowed public entitlement tables ──────────────────────────────
//
// Migration 0077 adds these tables. They are public by design.
// None of them match blocked patterns, but document them here for clarity.
const KNOWN_PUBLIC_ENTITLEMENT_TABLES = new Set([
  'commercial_plans',
  'commercial_plan_entitlements',
  'tenant_subscriptions',
  'tenant_entitlement_overrides',
  'tenant_usage_counters',
  'usage_events',
]);

// ── Pre-boundary public tables ─────────────────────────────────────────────────
//
// Tables that were already committed to the public repo before this boundary
// policy was established. They cannot be clawed back (Apache-2.0 releases are
// permanent). They are allowed here so the check does not false-positive on
// existing schema. New tables matching blocked patterns are still rejected.
//
// Do not add new entries to this list for tables added after 2026-06-07.
const PRE_BOUNDARY_PUBLIC_TABLES = new Set([
  'legal_hold_requests', // migration 0038 — already public before boundary policy
]);

/**
 * Extract table names from CREATE TABLE statements in SQL content.
 * Handles:
 *   CREATE TABLE foo (...)
 *   CREATE TABLE IF NOT EXISTS foo (...)
 *   CREATE TABLE schema.foo (...)
 *   CREATE TABLE IF NOT EXISTS schema.foo (...)
 */
function extractCreatedTableNames(sql) {
  const results = [];
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?(\w+)/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    results.push(m[1].toLowerCase());
  }
  return results;
}

// ── Scan migration files ──────────────────────────────────────────────────────

let files;
try {
  files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
} catch (err) {
  console.error(`Failed to read migrations directory: ${migrationsDir}`);
  console.error(err.message);
  process.exit(1);
}

const violations = [];

for (const file of files) {
  const filePath = join(migrationsDir, file);
  const content = readFileSync(filePath, 'utf8');
  const tableNames = extractCreatedTableNames(content);

  if (verbose && tableNames.length > 0) {
    console.log(`  ${file}: tables = [${tableNames.join(', ')}]`);
  }

  for (const tableName of tableNames) {
    if (KNOWN_PUBLIC_ENTITLEMENT_TABLES.has(tableName)) {
      if (verbose) {
        console.log(`  ✓ ${file}: ${tableName} (known public entitlement table)`);
      }
      continue;
    }

    if (PRE_BOUNDARY_PUBLIC_TABLES.has(tableName)) {
      if (verbose) {
        console.log(`  ✓ ${file}: ${tableName} (pre-boundary public table — grandfathered)`);
      }
      continue;
    }

    for (const blocked of BLOCKED_PATTERNS) {
      if (tableName.includes(blocked)) {
        violations.push({ file, tableName, blocked });
      }
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

if (violations.length > 0) {
  console.error('Public schema boundary check FAILED.\n');
  console.error('The following private-only table names were found in public migrations:\n');
  for (const { file, tableName, blocked } of violations) {
    console.error(`  ✗ ${file}: CREATE TABLE ${tableName}  (blocked pattern: "${blocked}")`);
  }
  console.error('\nPrivate schema must live in private commercial/enterprise modules.');
  console.error('See docs/commercial/private-schema-extension-policy.md for the full policy.');
  process.exit(1);
}

console.log(`Public schema boundary check passed. Scanned ${files.length} migration files.`);
if (verbose) {
  console.log(`Known public entitlement tables: ${[...KNOWN_PUBLIC_ENTITLEMENT_TABLES].join(', ')}`);
}
