#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const checkConfigOnly = args.includes('--check-config');
const manifestArg = args.find((arg) => arg.startsWith('--manifest='));
const manifestPath = manifestArg?.slice('--manifest='.length) ?? process.env.RELEASE_EVIDENCE_MANIFEST;

const requiredEvidence = [
  'ci_run_url',
  'codeql_run_url',
  'coverage_run_url',
  'docker_images_run_url',
  'freeswitch_smoke_run_url',
  'production_preflight',
  'production_e2e',
  'production_soak',
  'production_slo',
  'restore_smoke',
  'rate_limit_topology',
  'carrier_interop',
  'log_redaction',
  'rotation_rehearsal',
  'network_config',
  'security_review',
  'rollback_plan',
  'operator_signoff',
];

const requiredPbxEvidence = [
  'feature_codes',
  'call_parking',
  'conferencing',
  'gateway_reload',
  'self_service',
  'runtime_management',
];

const validStages = new Set(['beta', 'rc', 'production']);

const placeholderPatterns = [
  /\bTBD\b/i,
  /\bTODO\b/i,
  /\bplaceholder\b/i,
  /\bcheck-config\b/i,
  /\bexpected in dev\b/i,
  /\brequired before production\b/i,
  /\btarget-environment validation required\b/i,
  /\btracked in\b/i,
  /\bwill be validated\b/i,
  /\bupdate .* run url\b/i,
  /\bseparate operator signoff\b/i,
  /\bbeta candidate signoff\b/i,
  /\btemplate documented\b/i,
  /\bmust be re-run\b/i,
];

if (checkConfigOnly) {
  console.log('release evidence configuration check passed');
  process.exit(0);
}

if (!manifestPath) {
  console.error('release evidence manifest is required: pass --manifest=<file> or set RELEASE_EVIDENCE_MANIFEST');
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
}

function hasValue(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value === true;
}

function isValidUrl(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function hasPlaceholder(value) {
  if (typeof value === 'string') return placeholderPatterns.some((pattern) => pattern.test(value));
  if (Array.isArray(value)) return value.some((entry) => hasPlaceholder(entry));
  if (value && typeof value === 'object') return Object.values(value).some((entry) => hasPlaceholder(entry));
  return false;
}

function validateUrlField(failures, manifest, key) {
  if (!hasValue(manifest[key])) {
    failures.push(`${key} evidence is required`);
    return;
  }
  if (!isValidUrl(manifest[key])) failures.push(`${key} must be an http(s) URL`);
}

function validateTextEvidence(failures, manifest, key, stage) {
  if (!hasValue(manifest[key])) {
    failures.push(`${key} evidence is required`);
    return;
  }
  if (stage === 'production' && hasPlaceholder(manifest[key])) {
    failures.push(`${key} contains placeholder or deferred-production language`);
  }
}

try {
  const manifest = readJson(manifestPath);
  const failures = [];
  const stage = manifest.stage ?? 'production';

  if (!manifest.release_version) failures.push('release_version is required');
  if (!manifest.commit_sha) failures.push('commit_sha is required');
  if (!manifest.generated_at) failures.push('generated_at is required');
  if (!/^[0-9a-f]{40}$/i.test(manifest.commit_sha ?? '')) {
    failures.push('commit_sha must be a full 40-character git SHA');
  }
  if (!validStages.has(stage)) {
    failures.push(`stage must be one of: ${Array.from(validStages).join(', ')}`);
  }
  if (stage === 'beta' && !/-beta\./.test(manifest.release_version ?? '')) {
    failures.push('beta manifest release_version must contain a -beta.N suffix');
  }
  if (stage === 'rc' && !/-rc\./.test(manifest.release_version ?? '')) {
    failures.push('rc manifest release_version must contain a -rc.N suffix');
  }
  if (stage === 'production' && /-(alpha|beta|rc)\./.test(manifest.release_version ?? '')) {
    failures.push('production manifest release_version must not use an alpha, beta, or rc suffix');
  }

  for (const key of ['ci_run_url', 'codeql_run_url', 'coverage_run_url', 'docker_images_run_url', 'freeswitch_smoke_run_url']) {
    validateUrlField(failures, manifest, key);
  }

  for (const key of requiredEvidence.filter((key) => !key.endsWith('_url'))) {
    validateTextEvidence(failures, manifest, key, stage);
  }

  if (!manifest.pbx_evidence || typeof manifest.pbx_evidence !== 'object') {
    failures.push('pbx_evidence is required');
  } else {
    for (const key of requiredPbxEvidence) {
      const evidence = manifest.pbx_evidence[key];
      if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
        failures.push(`pbx_evidence.${key} must be an object with status, run_url, and artifact`);
        continue;
      }
      for (const field of ['status', 'run_url', 'artifact']) {
        if (!hasValue(evidence[field])) failures.push(`pbx_evidence.${key}.${field} is required`);
      }
      if (evidence.run_url && !isValidUrl(evidence.run_url)) {
        failures.push(`pbx_evidence.${key}.run_url must be an http(s) URL`);
      }
      if (stage === 'production' && hasPlaceholder(evidence)) {
        failures.push(`pbx_evidence.${key} contains placeholder or deferred-production language`);
      }
    }
  }

  for (const [key, value] of Object.entries(manifest.artifact_files ?? {})) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      failures.push(`artifact_files.${key} must be a non-empty path`);
      continue;
    }
    if (!existsSync(value)) failures.push(`artifact_files.${key} does not exist: ${value}`);
  }

  const signoff = manifest.operator_signoff ?? {};
  for (const field of ['name', 'role', 'approved_at']) {
    if (!signoff[field]) failures.push(`operator_signoff.${field} is required`);
  }
  if (stage === 'production' && hasPlaceholder(signoff)) {
    failures.push('operator_signoff contains placeholder or deferred-production language');
  }

  const githubRelease = manifest.github_release;
  if ((stage === 'rc' || stage === 'production') && (!githubRelease || typeof githubRelease !== 'object' || Array.isArray(githubRelease))) {
    failures.push(`github_release is required for ${stage} manifests`);
  }
  if (githubRelease && (typeof githubRelease !== 'object' || Array.isArray(githubRelease))) {
    failures.push('github_release must be an object when provided');
  } else if (githubRelease) {
    for (const field of ['tag', 'url', 'published_at']) {
      if (!hasValue(githubRelease[field])) failures.push(`github_release.${field} is required`);
    }
    if ('is_prerelease' in githubRelease && typeof githubRelease.is_prerelease !== 'boolean') {
      failures.push('github_release.is_prerelease must be a boolean');
    }
    if (githubRelease.url && !isValidUrl(githubRelease.url)) {
      failures.push('github_release.url must be an http(s) URL');
    }
    if (githubRelease.tag && githubRelease.tag !== manifest.release_version) {
      failures.push('github_release.tag must match release_version');
    }
    if (stage === 'rc' && githubRelease.is_prerelease !== true) {
      failures.push('rc manifests must reference a prerelease GitHub release');
    }
    if (stage === 'production' && githubRelease.is_prerelease !== false) {
      failures.push('production manifests must reference a full GitHub release (is_prerelease=false)');
    }
  }

  if (stage === 'production' && hasPlaceholder(manifest.notes ?? '')) {
    failures.push('notes contains placeholder or deferred-production language');
  }
  if (stage === 'production' && manifest.production_gate_status && hasPlaceholder(manifest.production_gate_status)) {
    failures.push('production_gate_status must not contain deferred or placeholder language for production manifests');
  }

  if (failures.length > 0) {
    console.error(`release evidence check failed (${failures.length} issue(s))`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log(`release evidence check passed for ${manifest.release_version} at ${manifest.commit_sha}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
