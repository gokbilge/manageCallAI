#!/usr/bin/env node
/**
 * API key capability catalog alignment check.
 *
 * Verifies that:
 *   1. Every capability value in CAPABILITIES (apps/api/src/modules/auth/capabilities.ts)
 *      is present in API_KEY_CAPABILITIES (packages/contracts/src/schemas/automation.ts).
 *   2. API_KEY_CAPABILITIES contains no values absent from CAPABILITIES (except '*').
 *
 * Exit 0 = aligned. Non-zero = drift detected.
 *
 * Usage: node scripts/check-api-key-capabilities.mjs
 */

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

try {
  execSync('pnpm --filter @managecallai/contracts build', { cwd: ROOT, stdio: 'inherit' });
  execSync('pnpm --filter @managecallai/api build', { cwd: ROOT, stdio: 'inherit' });
} catch {
  console.error('Build step failed');
  process.exit(1);
}

const { API_KEY_CAPABILITIES } = await import('@managecallai/contracts').catch((err) => {
  console.error('Failed to import @managecallai/contracts:', err.message);
  process.exit(1);
});

import { pathToFileURL } from 'node:url';
const apiCapabilitiesPath = pathToFileURL(resolve(ROOT, 'apps/api/dist/modules/auth/capabilities.js')).href;
const { CAPABILITIES } = await import(apiCapabilitiesPath).catch((err) => {
  console.error('Failed to import API capabilities:', err.message);
  process.exit(1);
});

const contractSet = new Set(API_KEY_CAPABILITIES);
const apiValues = new Set(Object.values(CAPABILITIES));

const failures = [];

// Every API capability must appear in contracts (so no capability is silently unaccepted).
for (const cap of apiValues) {
  if (!contractSet.has(cap)) {
    failures.push(`Capability '${cap}' is defined in CAPABILITIES but missing from API_KEY_CAPABILITIES in contracts`);
  }
}

// Every contract capability (except '*') must exist in API CAPABILITIES.
for (const cap of contractSet) {
  if (cap === '*') continue;
  if (!apiValues.has(cap)) {
    failures.push(`Capability '${cap}' is in API_KEY_CAPABILITIES but not defined in CAPABILITIES — remove or add it`);
  }
}

if (failures.length > 0) {
  console.error(`\nAPI key capability alignment check FAILED (${failures.length} issue(s)):\n`);
  for (const f of failures) console.error(`  ✗  ${f}`);
  process.exit(1);
} else {
  console.log('API key capability alignment check PASSED');
  process.exit(0);
}
