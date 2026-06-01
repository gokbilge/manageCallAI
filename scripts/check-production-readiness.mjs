#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';

const requiredFiles = [
  'scripts/production-runtime-e2e.mjs',
  'scripts/production-preflight.mjs',
  'scripts/check-runtime-e2e-evidence.mjs',
  'scripts/local-runtime-release-gate.sh',
  'scripts/restore-evidence-check.mjs',
  'docs/ops/templates/restore-evidence-template.json',
  'scripts/production-soak.mjs',
  'scripts/production-slo-check.mjs',
  'scripts/rate-limit-topology-check.mjs',
  'scripts/carrier-interop-check.mjs',
  'scripts/release-evidence-check.mjs',
  'scripts/restore-smoke.mjs',
  'scripts/restore-rehearsal.mjs',
  'scripts/check-production-network-config.mjs',
  'scripts/check-sip-tls-srtp-nat-evidence.mjs',
  'docs/ops/templates/sip-tls-srtp-nat-evidence-template.json',
  'scripts/check-runtime-token-rotation.mjs',
  'docs/ops/secret-rotation.md',
  'docs/ops/runtime-token-rotation.md',
  'scripts/redact-logs.mjs',
  'scripts/check-backup-retention-policy.mjs',
  'docs/ops/backup-retention.md',
  'docs/ops/templates/backup-retention-policy-template.json',
  '.github/workflows/freeswitch-smoke.yml',
  'docs/planning/slices/SLICE-52-production-runtime-e2e-gate.md',
  'docs/planning/slices/SLICE-53-production-deployment-and-network-hardening.md',
  'docs/planning/slices/SLICE-54-backup-restore-upgrade-and-dr.md',
  'docs/planning/slices/SLICE-55-load-and-soak-testing.md',
  'docs/planning/slices/SLICE-56-multi-instance-rate-limiting.md',
  'docs/planning/slices/SLICE-57-carrier-interop-certification.md',
  'docs/planning/slices/SLICE-58-runtime-slo-release-gate.md',
  'docs/planning/slices/SLICE-59-release-evidence-bundle.md',
  'docs/release/freeswitch-smoke-gate.md',
  'docs/release/production-runtime-e2e.md',
  'docs/release/release-evidence-bundle.md',
  'docs/ops/production-preflight.md',
  'docs/ops/production-soak-testing.md',
  'docs/ops/runtime-slo-gate.md',
  'docs/ops/rate-limit-topology.md',
  'docs/ops/carrier-interop.md',
  'docs/ops/restore-smoke.md',
  'docs/ops/network-hardening.md',
  'docs/ops/sip-tls-srtp-nat.md',
  'docs/ops/firewall-rules.md',
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`Missing required production-readiness file: ${file}`);
}

const gitignore = existsSync('.gitignore') ? readFileSync('.gitignore', 'utf8') : '';
if (!gitignore.includes('.local-prompts/')) {
  failures.push('.local-prompts/ must remain gitignored for local agent prompt files');
}

if (existsSync('.github/workflows/freeswitch-smoke.yml')) {
  const workflow = readFileSync('.github/workflows/freeswitch-smoke.yml', 'utf8');
  const requiredWorkflowFragments = [
    "name: FreeSWITCH Smoke",
    "name: FreeSWITCH runtime smoke",
    "runs-on: [self-hosted, freeswitch]",
    "pull_request:",
    "'release/**'",
    "'rc/**'",
    "pnpm production:e2e",
    "node scripts/sip-register-smoke.mjs",
    "go run . --smoke-check",
    "docker compose --profile freeswitch up",
    "docker compose --profile freeswitch down",
    "check-runtime-e2e-evidence.mjs",
    "actions/upload-artifact",
  ];

  for (const fragment of requiredWorkflowFragments) {
    if (!workflow.includes(fragment)) {
      failures.push(`FreeSWITCH smoke workflow missing required release-gate fragment: ${fragment}`);
    }
  }

  if (/continue-on-error:\s*true/.test(workflow)) {
    failures.push('FreeSWITCH smoke workflow must not use continue-on-error for release-gate steps');
  }

  if (/skip\s*=\s*true|FREESWITCH_SMOKE_AVAILABLE/.test(workflow)) {
    failures.push('FreeSWITCH smoke workflow must not silently skip release/RC smoke checks');
  }
}

if (existsSync('docs/release/release-checklist.md')) {
  const releaseChecklist = readFileSync('docs/release/release-checklist.md', 'utf8');
  if (!releaseChecklist.includes('FreeSWITCH runtime smoke')) {
    failures.push('Release checklist must name FreeSWITCH runtime smoke as the required release/RC status check');
  }
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
