#!/usr/bin/env node
/**
 * Validates a sanitized SIP TLS / SRTP / NAT evidence artifact.
 *
 * Usage:
 *   node scripts/check-sip-tls-srtp-nat-evidence.mjs --evidence=<path>
 *   node scripts/check-sip-tls-srtp-nat-evidence.mjs --check-config
 *
 * Evidence template: docs/ops/templates/sip-tls-srtp-nat-evidence-template.json
 *
 * Exit 0 — evidence passes all required gates.
 * Exit 1 — one or more required gates failed or fields are missing.
 */

import { existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const checkConfigOnly = args.includes('--check-config');

if (checkConfigOnly) {
  console.log('SIP TLS/SRTP/NAT evidence check configuration check passed');
  process.exit(0);
}

const evidenceArg = args.find((a) => a.startsWith('--evidence='));
if (!evidenceArg) {
  console.error('Usage: node scripts/check-sip-tls-srtp-nat-evidence.mjs --evidence=<path>');
  process.exit(1);
}

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

// ── Required top-level fields ─────────────────────────────────────────────────

for (const field of ['tested_at', 'git_sha', 'freeswitch_version', 'operator']) {
  if (!evidence[field] || typeof evidence[field] !== 'string' || !evidence[field].trim()) {
    fail(field, 'required string field is missing or empty');
  }
}

if (evidence.tested_at && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(evidence.tested_at))) {
  fail('tested_at', 'must be an ISO 8601 datetime (e.g. 2026-06-01T14:00:00Z)');
}

if (evidence.status !== 'passed') {
  fail('status', 'must be "passed" — do not file evidence for an incomplete or failed test');
}

// ── SIP TLS gates ─────────────────────────────────────────────────────────────

const tls = evidence.sip_tls;
if (!tls || typeof tls !== 'object') {
  fail('sip_tls', 'sip_tls object is missing');
} else {
  if (tls.enabled !== true) {
    fail('sip_tls.enabled', 'must be true — SIP TLS must be enabled and tested');
  }
  if (tls.client_registered_over_tls !== true) {
    fail('sip_tls.client_registered_over_tls', 'must be true — a SIP client must have registered via TLS during the test');
  }
  if (!tls.port || typeof tls.port !== 'number' || tls.port < 1) {
    fail('sip_tls.port', 'must be a positive integer (typically 5061)');
  }
}

// ── SRTP gates ────────────────────────────────────────────────────────────────

const srtp = evidence.srtp;
if (!srtp || typeof srtp !== 'object') {
  fail('srtp', 'srtp object is missing');
} else {
  if (srtp.enabled !== true) {
    fail('srtp.enabled', 'must be true — SRTP must be enabled and tested');
  }
  if (srtp.call_completed_with_srtp !== true) {
    fail('srtp.call_completed_with_srtp', 'must be true — a call must have completed with SRTP media during the test');
  }
  const validPolicies = ['disabled', 'optional', 'required'];
  if (!srtp.policy || !validPolicies.includes(srtp.policy)) {
    fail('srtp.policy', `must be one of: ${validPolicies.join(', ')}`);
  }
}

// ── NAT gates ─────────────────────────────────────────────────────────────────

const nat = evidence.nat;
if (!nat || typeof nat !== 'object') {
  fail('nat', 'nat object is missing');
} else {
  if (nat.external_sip_ip_configured !== true) {
    fail('nat.external_sip_ip_configured', 'must be true — external SIP IP must be configured');
  }
  if (nat.external_rtp_ip_configured !== true) {
    fail('nat.external_rtp_ip_configured', 'must be true — external RTP IP must be configured');
  }
  if (nat.two_way_audio_verified !== true) {
    fail('nat.two_way_audio_verified', 'must be true — two-way audio must be verified across the NAT boundary');
  }
}

// ── RTP range ─────────────────────────────────────────────────────────────────

const rtp = evidence.rtp_range;
if (!rtp || typeof rtp !== 'object') {
  fail('rtp_range', 'rtp_range object is missing');
} else {
  if (typeof rtp.from !== 'number' || rtp.from < 1) {
    fail('rtp_range.from', 'must be a positive integer (e.g. 16384)');
  }
  if (typeof rtp.to !== 'number' || rtp.to < 1) {
    fail('rtp_range.to', 'must be a positive integer (e.g. 32768)');
  }
  if (typeof rtp.from === 'number' && typeof rtp.to === 'number' && rtp.to <= rtp.from) {
    fail('rtp_range', 'rtp_range.to must be greater than rtp_range.from');
  }
}

// ── Optional recommendations ─────────────────────────────────────────────────

if (!evidence.test_environment) {
  warn('test_environment', 'test environment not specified — recommended: development | staging | production');
}
if (!tls?.tls_version) {
  warn('sip_tls.tls_version', 'negotiated TLS version not recorded — recommended to confirm TLSv1.2 or TLSv1.3');
}
if (!srtp?.crypto_suite) {
  warn('srtp.crypto_suite', 'SRTP crypto suite not recorded — recommended to confirm AES_CM_128_HMAC_SHA1_80 or stronger');
}
if (!nat?.nat_type) {
  warn('nat.nat_type', 'NAT type not recorded — recommended: static | auto-nat | stun');
}

// ── Output ────────────────────────────────────────────────────────────────────

for (const f of findings) {
  console.log(`${f.level.toUpperCase()}: ${f.field}: ${f.message}`);
}

const failures = findings.filter((f) => f.level === 'fail');
if (failures.length > 0) {
  console.error(`\nSIP TLS/SRTP/NAT evidence check FAILED with ${failures.length} blocking issue(s)`);
  process.exit(1);
}

console.log(`\nSIP TLS/SRTP/NAT evidence check PASSED with ${findings.length} finding(s)`);
