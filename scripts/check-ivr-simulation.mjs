#!/usr/bin/env node
/**
 * IVR call-flow simulation regression gate.
 *
 * Runs the IVR flow validation and simulation unit tests in the API package.
 * These tests cover the IVR graph validator and simulation engine against
 * golden scenarios, ensuring that published flow behavior doesn't regress.
 *
 * Exit code 0 = all tests pass. Non-zero = regression detected.
 *
 * Usage: node scripts/check-ivr-simulation.mjs
 */
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

try {
  execSync(
    'pnpm --filter @managecallai/api exec vitest run --reporter=verbose ' +
    'src/modules/ivr-flows/ivr-flow.validation.test.ts ' +
    'src/modules/ivr-flows/ivr-flow.service.test.ts ' +
    'src/modules/runtime/ivr-runtime.service.test.ts',
    { cwd: ROOT, stdio: 'inherit' },
  );
  console.log('IVR simulation regression check passed.');
} catch {
  console.error('IVR simulation regression check FAILED.');
  process.exit(1);
}
