#!/usr/bin/env node
/**
 * Secret scanning gate.
 *
 * Searches committed files for patterns that indicate hardcoded credentials or
 * demo defaults that must not appear outside of the explicitly allowed paths.
 *
 * Exit code 0 = no violations. Non-zero = violations found.
 *
 * Allowed paths (exceptions):
 *   - .env.example / .env.sample — documentation of required vars
 *   - docs/**            — documentation may reference example values
 *   - scripts/check-secrets.mjs — this file (contains the patterns)
 *   - apps/freeswitch-agent/config/freeswitch.cfg.example
 *   - Any file matching *.test.ts, *.spec.ts (test fixtures with seeded values)
 */

import { execSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../');

const ALLOWED_PATH_PATTERNS = [
  /\.env\.example$/,
  /\.env\.sample$/,
  /\.env\.test$/,
  /^docs\//,
  /^scripts\/check-secrets\.mjs$/,
  /\.test\.[tj]s$/,
  /\.spec\.[tj]s$/,
  /freeswitch.*\.example$/i,
  /CLAUDE\.md$/,
  /AGENTS\.md$/,
  // Docker development configurations legitimately reference default credentials
  // as placeholders for local-only environments. They must not be used in production.
  /^docker-compose\.yml$/,
  /^freeswitch\/docker\//,
  // CI workflow references ClueCon as a non-production ESL password for the CI environment.
  /^\.github\//,
  // Config source files reference default values in validation/rejection logic.
  // The presence of a default string in these files means the code is checking
  // it to REJECT it — the opposite of a secret leak.
  /apps\/api\/src\/config\/env\.[tj]s$/,
  /apps\/freeswitch-agent\/internal\/config\/config\.go$/,
  // The local runtime gate script documents the vendor default in a comment and
  // uses a split-string pattern in the code to avoid committing the literal value.
  /scripts\/local-runtime-release-gate\.sh$/,
  // The evidence validator assembles the vendor default via a split pattern to
  // detect it in submitted artifacts; the test file mirrors this approach.
  /scripts\/check-runtime-e2e-evidence\.(mjs|test\.mjs)$/,
  // Go _test.go files (covered by *.test.ts above, but Go uses _test.go suffix)
  /_test\.go$/,
];

const PATTERNS = [
  // Known demo/default secrets from the codebase
  { pattern: /change-me-to-a-long-random-string-in-production/, label: 'Default JWT_SECRET placeholder' },
  { pattern: /change-me-runtime-token/, label: 'Default RUNTIME_API_TOKEN placeholder' },
  { pattern: /ClueCon/, label: 'Default FreeSWITCH ESL password (ClueCon)' },
  // Generic high-confidence secret patterns
  { pattern: /-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----/, label: 'Private key block' },
  { pattern: /AKIA[0-9A-Z]{16}/, label: 'AWS access key ID' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/, label: 'GitHub personal access token (ghp_)' },
  { pattern: /ghs_[a-zA-Z0-9]{36}/, label: 'GitHub actions token (ghs_)' },
  { pattern: /sk-[a-zA-Z0-9]{48}/, label: 'OpenAI API key (sk-)' },
];

function isAllowedPath(filePath) {
  const rel = relative(ROOT, filePath).replace(/\\/g, '/');
  return ALLOWED_PATH_PATTERNS.some((p) => p.test(rel));
}

// Get list of tracked files from git
let trackedFiles;
try {
  const out = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' });
  trackedFiles = out.trim().split('\n').filter(Boolean);
} catch {
  console.error('Failed to list git tracked files. Ensure git is available.');
  process.exit(1);
}

import { readFileSync } from 'node:fs';

const violations = [];

for (const relPath of trackedFiles) {
  const absPath = resolve(ROOT, relPath);
  if (isAllowedPath(absPath)) continue;

  let content;
  try {
    content = readFileSync(absPath, 'utf8');
  } catch {
    continue; // Binary or unreadable file
  }

  for (const { pattern, label } of PATTERNS) {
    if (pattern.test(content)) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i] ?? '')) {
          violations.push(`${relPath}:${i + 1}: ${label}`);
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Secret scan FAILED. The following potential secrets were found:\n');
  for (const v of violations) {
    console.error(`  ✗ ${v}`);
  }
  console.error('\nIf these are false positives, add the file path to ALLOWED_PATH_PATTERNS in scripts/check-secrets.mjs.');
  process.exit(1);
}

console.log(`Secret scan passed. Checked ${trackedFiles.length} tracked files.`);
