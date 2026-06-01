#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';

const requiredFiles = [
  'scripts/production-runtime-e2e.mjs',
  'scripts/production-preflight.mjs',
  'scripts/production-soak.mjs',
  'scripts/rate-limit-topology-check.mjs',
  'scripts/carrier-interop-check.mjs',
  'scripts/restore-smoke.mjs',
  'scripts/redact-logs.mjs',
  'docs/planning/slices/SLICE-52-production-runtime-e2e-gate.md',
  'docs/planning/slices/SLICE-53-production-deployment-and-network-hardening.md',
  'docs/planning/slices/SLICE-54-backup-restore-upgrade-and-dr.md',
  'docs/planning/slices/SLICE-55-load-and-soak-testing.md',
  'docs/planning/slices/SLICE-56-multi-instance-rate-limiting.md',
  'docs/planning/slices/SLICE-57-carrier-interop-certification.md',
  'docs/release/production-runtime-e2e.md',
  'docs/ops/production-preflight.md',
  'docs/ops/production-soak-testing.md',
  'docs/ops/rate-limit-topology.md',
  'docs/ops/carrier-interop.md',
  'docs/ops/restore-smoke.md',
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`Missing required production-readiness file: ${file}`);
}

const gitignore = existsSync('.gitignore') ? readFileSync('.gitignore', 'utf8') : '';
if (!gitignore.includes('.local-prompts/')) {
  failures.push('.local-prompts/ must remain gitignored for local agent prompt files');
}

const sliceFiles = existsSync('docs/planning/slices')
  ? readdirSync('docs/planning/slices')
    .filter((file) => /^SLICE-\d+-.+\.md$/.test(file))
    .map((file) => `docs/planning/slices/${file}`)
  : [];

for (const file of sliceFiles) {
  if (!existsSync(file)) continue;
  const content = readFileSync(file, 'utf8');
  if (/Claude Prompt|Suggested Claude Prompt|```text\s*You are a/i.test(content)) {
    failures.push(`${file} contains local-agent prompt content; keep prompts under .local-prompts/`);
  }
}

if (failures.length > 0) {
  console.error(`Production readiness check FAILED (${failures.length} issue(s))`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('Production readiness check PASSED');
