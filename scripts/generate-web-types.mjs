#!/usr/bin/env node
/**
 * Generates TypeScript types for the web app from the OpenAPI spec.
 * Delegates to the @managecallai/sdk package's generate script.
 *
 * Run:
 *   node scripts/generate-web-types.mjs
 *
 * Or equivalently:
 *   pnpm --filter @managecallai/sdk generate
 */

import { execSync } from 'node:child_process';

console.log('Generating web types from OpenAPI spec...');
execSync('pnpm --filter @managecallai/sdk generate', { stdio: 'inherit' });
console.log('Web types generated at packages/sdk/src/generated/schema.ts');
