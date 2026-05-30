#!/usr/bin/env node
/**
 * Webhook payload coverage check.
 *
 * Verifies that every event in WEBHOOK_EVENTS has a corresponding entry in
 * WEBHOOK_PAYLOAD_SCHEMAS exported from @managecallai/contracts.
 *
 * Exit 0 = full coverage. Non-zero = missing payload schemas.
 *
 * Usage: node scripts/check-webhook-payloads.mjs
 */

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

try {
  execSync('pnpm --filter @managecallai/contracts build', { cwd: ROOT, stdio: 'inherit' });
} catch {
  console.error('Failed to build @managecallai/contracts');
  process.exit(1);
}

const { WEBHOOK_EVENTS, WEBHOOK_PAYLOAD_SCHEMAS } = await import('@managecallai/contracts').catch((err) => {
  console.error('Failed to import @managecallai/contracts:', err.message);
  process.exit(1);
});

const failures = [];

for (const event of WEBHOOK_EVENTS) {
  if (!WEBHOOK_PAYLOAD_SCHEMAS[event]) {
    failures.push(`Missing payload schema for event: '${event}' — add it to packages/contracts/src/schemas/automation.ts`);
  }
}

// Also verify no extra schemas reference non-existent events.
const eventSet = new Set(WEBHOOK_EVENTS);
for (const event of Object.keys(WEBHOOK_PAYLOAD_SCHEMAS)) {
  if (!eventSet.has(event)) {
    failures.push(`Orphaned payload schema for unknown event: '${event}' — remove it or add the event to WEBHOOK_EVENTS`);
  }
}

if (failures.length > 0) {
  console.error(`\nWebhook payload coverage check FAILED (${failures.length} issue(s)):\n`);
  for (const f of failures) console.error(`  ✗  ${f}`);
  process.exit(1);
} else {
  console.log(`Webhook payload coverage check PASSED — ${WEBHOOK_EVENTS.length} events covered`);
  process.exit(0);
}
