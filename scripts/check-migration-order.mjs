#!/usr/bin/env node
/**
 * Migration order and naming guard.
 *
 * Rules enforced:
 *   1. Every file in db/migrations/ must match /^\d{4}_.+\.sql$/.
 *   2. Numeric prefixes must be unique OR appear in the documented noop-shim
 *      allow-list below.  Undocumented duplicate prefixes fail the check.
 *   3. The highest prefix must equal the number of distinct numeric prefixes
 *      (no unexplained gaps — each gap must be a documented noop shim).
 *   4. The documented noop-shim pairs must still exist on disk; removing a
 *      shim file without updating this guard fails the check.
 *
 * Noop-shim pairs arise when a migration file was renamed/renumbered after
 * being applied in production.  The original file becomes an empty shim that
 * preserves the schema_migrations row; the actual SQL moves to a new number.
 * Every such pair must be documented in NOOP_SHIM_PAIRS below.
 *
 * Usage:
 *   node scripts/check-migration-order.mjs
 *   node scripts/check-migration-order.mjs --verbose
 *
 * Exit 0 — all checks pass.
 * Exit 1 — one or more violations found.
 */

import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dir, '..', 'db', 'migrations');
const verbose = process.argv.includes('--verbose');

// ── Documented noop-shim pairs ────────────────────────────────────────────────
//
// Each entry documents ONE duplicate numeric prefix.
// Fields:
//   prefix   — the 4-digit number that appears on both files
//   shim     — the filename that is a noop placeholder
//   real     — the filename that contains the actual DDL (may be a later number)
//   reason   — human-readable explanation, referenced in db/README.md
//
// Adding a new noop shim REQUIRES adding an entry here AND updating db/README.md.
// Removing a shim file from disk REQUIRES removing the entry here.

const NOOP_SHIM_PAIRS = [
  {
    prefix: '0005',
    shim: '0005_relax_inbound_route_match_uniqueness.sql',
    real: '0005_explicit_sip_trunk_fields.sql',
    reason:
      'Original 0005 was renamed; actual uniqueness-relaxation DDL moved to 0007. ' +
      'Shim retained to preserve schema_migrations history.',
  },
  {
    prefix: '0015',
    shim: '0015_outbound_routes.sql',
    real: '0015_add_ivr_flow_session_steps.sql',
    reason:
      'Original 0015 outbound-routes DDL renumbered to 0021. ' +
      'Shim retained to preserve schema_migrations history.',
  },
  {
    prefix: '0016',
    shim: '0016_outbound_call_requests.sql',
    real: '0016_add_queues_and_voicemail.sql',
    reason:
      'Original 0016 outbound-call-requests DDL renumbered to 0022. ' +
      'Shim retained to preserve schema_migrations history.',
  },
];

// Build lookup structures for documented shim pairs
const documentedDuplicates = new Map(); // prefix -> { shim, real, reason }
for (const pair of NOOP_SHIM_PAIRS) {
  documentedDuplicates.set(pair.prefix, pair);
}

// ── Load migration files ───────────────────────────────────────────────────────

let files;
try {
  files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
} catch (err) {
  console.error(`check-migration-order: cannot read ${migrationsDir}: ${err.message}`);
  process.exit(1);
}

// ── Checks ─────────────────────────────────────────────────────────────────────

const errors = [];

const FILENAME_RE = /^(\d{4})_.+\.sql$/;
const byPrefix = new Map(); // prefix -> filename[]

for (const file of files) {
  const match = file.match(FILENAME_RE);
  if (!match) {
    errors.push(`Invalid filename — does not match \\d{4}_.+\\.sql: ${file}`);
    continue;
  }
  const prefix = match[1];
  if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
  byPrefix.get(prefix).push(file);
}

// Check for duplicates
for (const [prefix, names] of byPrefix) {
  if (names.length === 1) continue;

  if (names.length > 2) {
    errors.push(
      `Prefix ${prefix} appears on ${names.length} files — at most one noop shim allowed: ${names.join(', ')}`,
    );
    continue;
  }

  // Exactly 2 files with this prefix
  const doc = documentedDuplicates.get(prefix);
  if (!doc) {
    errors.push(
      `Undocumented duplicate prefix ${prefix}: ${names.join(', ')}\n` +
      `  → Add an entry to NOOP_SHIM_PAIRS in scripts/check-migration-order.mjs and update db/README.md.`,
    );
    continue;
  }

  const hasShim = names.includes(doc.shim);
  const hasReal = names.includes(doc.real);

  if (!hasShim) {
    errors.push(
      `Documented noop shim not found on disk: ${doc.shim} (prefix ${prefix})\n` +
      `  → Either restore the file or remove its entry from NOOP_SHIM_PAIRS.`,
    );
  }
  if (!hasReal) {
    errors.push(
      `Documented real migration not found on disk: ${doc.real} (prefix ${prefix})\n` +
      `  → Either restore the file or update the NOOP_SHIM_PAIRS entry.`,
    );
  }
  if (hasShim && hasReal && verbose) {
    console.log(`  ✓  Documented noop shim: ${doc.shim} → ${doc.real}`);
  }
}

// Verify all documented pairs still exist on disk (even if their prefix is now unique)
for (const pair of NOOP_SHIM_PAIRS) {
  if (!files.includes(pair.shim)) {
    errors.push(
      `NOOP_SHIM_PAIRS entry references a file that no longer exists: ${pair.shim}\n` +
      `  → Remove the entry from NOOP_SHIM_PAIRS in scripts/check-migration-order.mjs.`,
    );
  }
}

// Check numeric ordering: prefixes must be contiguous 0001 … N
// (Gaps are only allowed if they correspond to a documented standalone noop,
// i.e. a single file like 0003_noop.sql that simply documents a squash.)
const allPrefixes = [...byPrefix.keys()].map(Number).sort((a, b) => a - b);
if (allPrefixes[0] !== 1) {
  errors.push(`First migration prefix must be 0001, found ${String(allPrefixes[0]).padStart(4, '0')}`);
}

for (let i = 1; i < allPrefixes.length; i++) {
  const expected = allPrefixes[i - 1] + 1;
  const actual = allPrefixes[i];
  if (actual !== expected) {
    errors.push(
      `Gap in migration sequence: expected ${String(expected).padStart(4, '0')} after ` +
      `${String(allPrefixes[i - 1]).padStart(4, '0')}, found ${String(actual).padStart(4, '0')}\n` +
      `  → If this gap is intentional, add a noop shim with the missing number and document it.`,
    );
  }
}

// ── Report ─────────────────────────────────────────────────────────────────────

const distinctPrefixes = byPrefix.size;
const totalFiles = files.length;
const shimCount = NOOP_SHIM_PAIRS.length;

if (verbose) {
  console.log(`\nMigration files: ${totalFiles} (${distinctPrefixes} distinct prefixes, ${shimCount} noop shims)`);
  for (const [prefix, names] of byPrefix) {
    for (const name of names) {
      console.log(`  ${prefix}  ${name}`);
    }
  }
  console.log('');
}

if (errors.length > 0) {
  console.error(`\ncheck-migration-order FAILED — ${errors.length} violation(s):\n`);
  for (const msg of errors) {
    console.error(`  ✗  ${msg}`);
  }
  console.error('');
  process.exit(1);
} else {
  console.log(
    `check-migration-order PASSED — ${totalFiles} files, ` +
    `${distinctPrefixes} prefixes, ${shimCount} documented noop shim(s)`,
  );
}
