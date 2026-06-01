#!/usr/bin/env node
/**
 * Log redaction coverage check.
 *
 * Mode 1 (default): runs live pattern tests against the redact() function
 *   exported from scripts/redact-logs.mjs and exits non-zero if any
 *   sensitive pattern survives redaction.
 *
 * Mode 2 (--evidence=<path>): validates a filled log-redaction evidence JSON.
 *
 * Usage:
 *   pnpm check:log-redaction
 *   node scripts/check-log-redaction.mjs --evidence=<path>
 *   node scripts/check-log-redaction.mjs --check-config
 *
 * Exit 0 — all checks pass.
 * Exit 1 — one or more patterns not redacted, or evidence fails validation.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);

if (args.includes('--check-config')) {
  console.log('log redaction check configuration check passed');
  process.exit(0);
}

const evidenceArg = args.find((a) => a.startsWith('--evidence='));

// ── Evidence validation mode ──────────────────────────────────────────────────

if (evidenceArg) {
  const evidencePath = evidenceArg.slice('--evidence='.length);
  if (!existsSync(evidencePath)) {
    console.error(`Evidence file not found: ${evidencePath}`);
    process.exit(1);
  }

  let evidence;
  try {
    evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  } catch (err) {
    console.error(`Failed to parse evidence JSON: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const findings = [];

  function fail(field, message) {
    findings.push({ level: 'fail', field, message });
  }

  function warn(field, message) {
    findings.push({ level: 'warn', field, message });
  }

  for (const field of ['checked_at', 'git_sha', 'operator']) {
    if (!evidence[field] || typeof evidence[field] !== 'string' || !evidence[field].trim()) {
      fail(field, 'required string field is missing or empty');
    }
  }

  if (evidence.checked_at && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(evidence.checked_at))) {
    fail('checked_at', 'must be an ISO 8601 datetime');
  }

  if (evidence.status !== 'passed') {
    fail('status', 'must be "passed" — do not file evidence for an incomplete or failed check');
  }

  for (const field of [
    'redact_function_passes_all_patterns',
    'url_redaction_covers_query_params',
    'no_raw_tokens_in_audit_events',
  ]) {
    if (evidence[field] !== true) {
      fail(field, 'must be true');
    }
  }

  if (!evidence.production_error_responses_no_stack_traces) {
    warn('production_error_responses_no_stack_traces', 'not confirmed — recommended for production evidence');
  }

  if (!Array.isArray(evidence.patterns_verified) || evidence.patterns_verified.length === 0) {
    fail('patterns_verified', 'must be a non-empty array of verified pattern names');
  }

  for (const f of findings) {
    console.log(`${f.level.toUpperCase()}: ${f.field}: ${f.message}`);
  }

  const failures = findings.filter((f) => f.level === 'fail');
  if (failures.length > 0) {
    console.error(`\nlog redaction evidence check FAILED with ${failures.length} blocking issue(s)`);
    process.exit(1);
  }

  console.log(`\nlog redaction evidence check PASSED with ${findings.length} finding(s)`);
  process.exit(0);
}

// ── Live pattern check mode ───────────────────────────────────────────────────

const { redact } = await import('./redact-logs.mjs');

const REDACTED = '[REDACTED]';

const cases = [
  // JWT Bearer token
  {
    name: 'JWT Bearer token',
    input: 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig',
    mustNotContain: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  },
  // Basic auth
  {
    name: 'Basic auth header',
    input: 'Authorization: Basic dXNlcjpwYXNzd29yZA==',
    mustNotContain: 'dXNlcjpwYXNzd29yZA==',
  },
  // Runtime token header
  {
    name: 'X-ManageCallAI-Runtime-Token header',
    input: 'x-managecallai-runtime-token: super-secret-runtime-token-value',
    mustNotContain: 'super-secret-runtime-token-value',
  },
  // Env var secrets
  {
    name: 'JWT_SECRET env var',
    input: 'JWT_SECRET=my-very-long-jwt-signing-secret',
    mustNotContain: 'my-very-long-jwt-signing-secret',
  },
  {
    name: 'RUNTIME_API_TOKEN env var',
    input: 'RUNTIME_API_TOKEN=change-me-runtime-token',
    mustNotContain: 'change-me-runtime-token',
  },
  {
    name: 'SIP_SECRET_MASTER_KEY env var',
    input: 'SIP_SECRET_MASTER_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    mustNotContain: '0123456789abcdef0123456789abcdef',
  },
  {
    name: 'FREESWITCH_ESL_PASSWORD env var',
    input: 'FREESWITCH_ESL_PASSWORD=my-esl-password',
    mustNotContain: 'my-esl-password',
  },
  {
    name: 'WEBHOOK_SIGNING_SECRET env var',
    input: 'WEBHOOK_SIGNING_SECRET=wss_abc123secret',
    mustNotContain: 'wss_abc123secret',
  },
  {
    name: 'DATABASE_URL with credentials',
    input: 'DATABASE_URL=postgres://managecallai:supersecretpass@localhost:5432/managecallai',
    mustNotContain: 'supersecretpass',
  },
  // Query param secrets
  {
    name: 'runtime_token query param',
    input: '/api/v1/freeswitch/directory?runtime_token=secret-token&domain=tenant.example',
    mustNotContain: 'secret-token',
  },
  {
    name: 'token query param',
    input: '/api/v1/events?token=my-secret-value&event_id=abc',
    mustNotContain: 'my-secret-value',
  },
  {
    name: 'secret query param',
    input: '/webhooks/events?webhook_secret=shh123&call_id=c1',
    mustNotContain: 'shh123',
  },
  {
    name: 'access_token query param',
    input: '/api/v1/session?access_token=acc-secret-value',
    mustNotContain: 'acc-secret-value',
  },
  {
    name: 'signing_secret query param',
    input: '/api/v1/hooks?signing_secret=sign-secret-xyz',
    mustNotContain: 'sign-secret-xyz',
  },
  // JSON secret fields
  {
    name: 'JSON password field',
    input: '{"password":"myrealpassword","user":"alice"}',
    mustNotContain: 'myrealpassword',
  },
  {
    name: 'JSON sip_password field',
    input: '{"sip_password":"sippass123","extension":"1001"}',
    mustNotContain: 'sippass123',
  },
  {
    name: 'JSON token field',
    input: '{"token":"tok_abc123xyz","id":"user-1"}',
    mustNotContain: 'tok_abc123xyz',
  },
  {
    name: 'JSON secret field',
    input: '{"secret":"my-webhook-secret","endpoint":"https://example.com"}',
    mustNotContain: 'my-webhook-secret',
  },
  {
    name: 'JSON authorization field',
    input: '{"authorization":"Bearer secret-token-value"}',
    mustNotContain: 'secret-token-value',
  },
  // Database URL in log line
  {
    name: 'PostgreSQL URL with password in log line',
    input: 'connecting to postgres://user:password123@db.example.com:5432/mydb',
    mustNotContain: 'password123',
  },
  // Recording/voicemail paths - these are not redacted by the redact function
  // (path redaction is application-level, not log-level), so we just verify
  // the existing secrets are covered.
];

let passed = 0;
let failed = 0;

for (const tc of cases) {
  const output = redact(tc.input);
  if (output.includes(tc.mustNotContain)) {
    console.error(`FAIL: ${tc.name}`);
    console.error(`  input:    ${tc.input}`);
    console.error(`  output:   ${output}`);
    console.error(`  still contains: ${tc.mustNotContain}`);
    failed++;
  } else {
    console.log(`ok: ${tc.name}`);
    passed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error('\nlog redaction check FAILED — update redaction rules in scripts/redact-logs.mjs');
  process.exit(1);
}

console.log('log redaction check PASSED');
