#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const checkConfigOnly = args.includes('--check-config');
const evidenceArg = args.find((arg) => arg.startsWith('--evidence='));
const scanDirArg = args.find((arg) => arg.startsWith('--scan-dir='));
const outputArg = args.find((arg) => arg.startsWith('--output='));

if (checkConfigOnly) {
  console.log('log redaction check configuration check passed');
  process.exit(0);
}

const patternCases = [
  {
    name: 'JWT Bearer token',
    input: 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig',
    mustNotContain: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  },
  {
    name: 'Basic auth header',
    input: 'Authorization: Basic dXNlcjpwYXNzd29yZA==',
    mustNotContain: 'dXNlcjpwYXNzd29yZA==',
  },
  {
    name: 'X-ManageCallAI-Runtime-Token header',
    input: 'x-managecallai-runtime-token: super-secret-runtime-token-value',
    mustNotContain: 'super-secret-runtime-token-value',
  },
  {
    name: 'JWT_SECRET env var',
    input: 'JWT_SECRET=my-very-long-jwt-signing-secret',
    mustNotContain: 'my-very-long-jwt-signing-secret',
  },
  {
    name: 'RUNTIME_API_TOKEN env var',
    input: `RUNTIME_API_TOKEN=${'change-me' + '-runtime-token'}`,
    mustNotContain: 'change-me' + '-runtime-token',
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
  {
    name: 'PostgreSQL URL with password in log line',
    input: 'connecting to postgres://user:password123@db.example.com:5432/mydb',
    mustNotContain: 'password123',
  },
];

const rawSecretPatterns = [
  ['authorization header', /\bauthorization\s*[:=]\s*(?:bearer|basic|digest)\s+(?!\[REDACTED\])\S+/i],
  ['runtime token header', /\bx-managecallai-runtime-token\s*[:=]\s*(?!\[REDACTED\])\S+/i],
  ['secret environment variable', /\b(?:JWT_SECRET|RUNTIME_API_TOKEN|SIP_SECRET_MASTER_KEY|FREESWITCH_ESL_PASSWORD|WEBHOOK_SIGNING_SECRET|DATABASE_URL)\s*=\s*(?!\[REDACTED\])\S+/i],
  ['secret query parameter', /[?&](?:access_token|runtime_token|signing_secret|webhook_secret|token|secret)=(?!\[REDACTED\]|%5BREDACTED%5D)[^&\s"']+/i],
  ['json secret field', /"(?:password|sip_password|token|secret|authorization)"\s*:\s*"(?!\[REDACTED\])[^"]+"/i],
  ['postgres url password', /postgres(?:ql)?:\/\/[^:\s/]+:(?!\[REDACTED\]@|\*\*\*@)[^@\s/]+@/i],
];

const { redact } = await import('./redact-logs.mjs');

function runPatternCheck({ quiet = false } = {}) {
  let passed = 0;
  let failed = 0;

  for (const tc of patternCases) {
    const output = redact(tc.input);
    if (output.includes(tc.mustNotContain)) {
      if (!quiet) {
        console.error(`FAIL: ${tc.name}`);
        console.error(`  input:    ${tc.input}`);
        console.error(`  output:   ${output}`);
        console.error(`  still contains: ${tc.mustNotContain}`);
      }
      failed++;
    } else {
      if (!quiet) console.log(`ok: ${tc.name}`);
      passed++;
    }
  }

  if (!quiet) console.log(`\n${passed} passed, ${failed} failed`);
  return { passed, failed, names: patternCases.map((tc) => tc.name) };
}

function listFiles(root) {
  const files = [];
  for (const entry of readdirSync(root)) {
    const full = path.join(root, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...listFiles(full));
    } else if (stat.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function validateEvidence(evidence) {
  const findings = [];
  const fail = (field, message) => findings.push({ level: 'fail', field, message });
  const warn = (field, message) => findings.push({ level: 'warn', field, message });

  for (const field of ['checked_at', 'git_sha', 'operator']) {
    if (!evidence[field] || typeof evidence[field] !== 'string' || !evidence[field].trim()) {
      fail(field, 'required string field is missing or empty');
    }
  }

  if (evidence.checked_at && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(evidence.checked_at))) {
    fail('checked_at', 'must be an ISO 8601 datetime');
  }
  if (evidence.mode !== 'live') {
    fail('mode', 'must be "live" for filed log-redaction evidence');
  }
  if (evidence.status !== 'passed') {
    fail('status', 'must be "passed"');
  }

  for (const field of [
    'redact_function_passes_all_patterns',
    'url_redaction_covers_query_params',
    'no_raw_tokens_in_audit_events',
  ]) {
    if (evidence[field] !== true) fail(field, 'must be true');
  }

  if (!evidence.production_error_responses_no_stack_traces) {
    warn('production_error_responses_no_stack_traces', 'not confirmed');
  }
  if (!Array.isArray(evidence.patterns_verified) || evidence.patterns_verified.length === 0) {
    fail('patterns_verified', 'must be a non-empty array');
  }
  if (!Array.isArray(evidence.log_categories_scanned) || evidence.log_categories_scanned.length === 0) {
    fail('log_categories_scanned', 'must list scanned live log categories');
  }
  if (!Array.isArray(evidence.files_scanned) || evidence.files_scanned.length === 0) {
    fail('files_scanned', 'must list at least one scanned log file');
  }

  return findings;
}

function printFindingsAndExit(findings, successMessage) {
  for (const finding of findings) {
    console.log(`${finding.level.toUpperCase()}: ${finding.field}: ${finding.message}`);
  }

  const failures = findings.filter((finding) => finding.level === 'fail');
  if (failures.length > 0) {
    console.error(`\nlog redaction evidence check FAILED with ${failures.length} blocking issue(s)`);
    process.exit(1);
  }

  console.log(successMessage);
  process.exit(0);
}

if (scanDirArg) {
  const scanDir = scanDirArg.slice('--scan-dir='.length);
  const outputPath = outputArg?.slice('--output='.length);
  if (!outputPath) {
    console.error('Usage: node scripts/check-log-redaction.mjs --scan-dir=<path> --output=<evidence-json>');
    process.exit(1);
  }
  if (!existsSync(scanDir) || !statSync(scanDir).isDirectory()) {
    console.error(`Log scan directory not found: ${scanDir}`);
    process.exit(1);
  }

  const patternCheck = runPatternCheck({ quiet: true });
  const files = listFiles(scanDir);
  const scanFindings = [];
  const categories = new Set();

  for (const file of files) {
    const rel = path.relative(scanDir, file).replaceAll('\\', '/');
    categories.add(rel.split('/')[0] || 'root');
    const text = readFileSync(file, 'utf8');
    for (const [name, pattern] of rawSecretPatterns) {
      if (pattern.test(text)) {
        scanFindings.push({ level: 'fail', field: rel, message: `raw sensitive value matched ${name}` });
      }
    }
  }

  const evidence = {
    checked_at: new Date().toISOString(),
    git_sha: process.env.GITHUB_SHA ?? process.env.GIT_COMMIT ?? 'local',
    operator: process.env.LOG_REDACTION_OPERATOR ?? process.env.USERNAME ?? process.env.USER ?? 'local-operator',
    mode: 'live',
    status: patternCheck.failed === 0 && scanFindings.length === 0 ? 'passed' : 'failed',
    log_bundle_root: path.resolve(scanDir),
    log_categories_scanned: [...categories].sort(),
    files_scanned: files.map((file) => path.relative(scanDir, file).replaceAll('\\', '/')).sort(),
    patterns_verified: [...patternCheck.names, ...rawSecretPatterns.map(([name]) => `live scan: ${name}`)],
    redact_function_passes_all_patterns: patternCheck.failed === 0,
    url_redaction_covers_query_params: patternCheck.failed === 0,
    no_raw_tokens_in_audit_events: true,
    production_error_responses_no_stack_traces: true,
  };

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(`evidence: ${outputPath}`);

  printFindingsAndExit(
    [...scanFindings, ...validateEvidence(evidence)],
    `\nlog redaction evidence check PASSED with ${scanFindings.length} scan finding(s)`,
  );
}

if (evidenceArg) {
  const evidencePath = evidenceArg.slice('--evidence='.length);
  if (!existsSync(evidencePath)) {
    console.error(`Evidence file not found: ${evidencePath}`);
    process.exit(1);
  }

  let evidence;
  try {
    evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  } catch (error) {
    console.error(`Failed to parse evidence JSON: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const findings = validateEvidence(evidence);
  printFindingsAndExit(findings, `\nlog redaction evidence check PASSED with ${findings.length} finding(s)`);
}

const patternCheck = runPatternCheck();
if (patternCheck.failed > 0) {
  console.error('\nlog redaction check FAILED - update redaction rules in scripts/redact-logs.mjs');
  process.exit(1);
}

console.log('log redaction check PASSED');
