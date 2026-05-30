#!/usr/bin/env node
/**
 * Validates that no two migration files share the same numeric prefix,
 * except for known no-op compatibility shims that intentionally keep an
 * already-recorded filename so existing schema_migrations rows are not
 * disturbed.
 *
 * Run: node scripts/check-migrations.mjs
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dir, '..', 'db', 'migrations');

// Files that are intentional no-op shims kept for backwards compatibility.
// A shim must contain only comments — no executable SQL.
const KNOWN_SHIMS = new Set([
  '0015_outbound_routes.sql',
  '0016_outbound_call_requests.sql',
]);

function isShim(filepath) {
  const content = readFileSync(filepath, 'utf8');
  // A shim has no non-comment, non-whitespace content.
  return !content
    .split('\n')
    .some(line => line.trim() && !line.trim().startsWith('--'));
}

const files = readdirSync(migrationsDir)
  .filter(name => name.endsWith('.sql'))
  .sort();

const prefixToFiles = new Map();

for (const file of files) {
  const match = file.match(/^(\d+)/);
  if (!match) continue;
  const prefix = match[1];
  if (!prefixToFiles.has(prefix)) prefixToFiles.set(prefix, []);
  prefixToFiles.get(prefix).push(file);
}

let errors = 0;

for (const [prefix, group] of prefixToFiles) {
  if (group.length === 1) continue;

  const nonShims = group.filter(f => {
    if (KNOWN_SHIMS.has(f)) return false;
    if (isShim(join(migrationsDir, f))) return false;
    return true;
  });

  if (nonShims.length > 1) {
    console.error(`ERROR: Multiple non-shim migrations share prefix ${prefix}:`);
    for (const f of group) {
      const label = KNOWN_SHIMS.has(f) || isShim(join(migrationsDir, f)) ? '(shim)' : '(CONFLICT)';
      console.error(`  ${label}  ${f}`);
    }
    errors++;
  }
}

if (errors > 0) {
  console.error(`\n${errors} migration prefix conflict(s) found. Rename the conflicting files.`);
  process.exit(1);
}

console.log(`Migration prefix check: OK (${files.length} files, ${prefixToFiles.size} prefixes)`);
