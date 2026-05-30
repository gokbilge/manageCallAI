#!/usr/bin/env node
/**
 * MCP contract drift check.
 *
 * Runs the MCP vitest test suite, which includes contract-drift.test.ts.
 * Exit code 0 = all tests pass. Non-zero = drift detected.
 *
 * Usage: node scripts/check-mcp-contracts.mjs
 */
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

try {
  execSync('pnpm --filter @managecallai/mcp test', {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, MANAGECALL_API_KEY: 'ci-test-key', MANAGECALL_API_URL: 'http://localhost:9999' },
  });
  console.log('MCP contract drift check passed.');
} catch {
  console.error('MCP contract drift check FAILED.');
  process.exit(1);
}
