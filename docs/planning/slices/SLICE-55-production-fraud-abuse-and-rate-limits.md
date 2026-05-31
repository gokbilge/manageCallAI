# SLICE-55 Production Fraud, Abuse, And Rate-Limit Hardening

## Priority

P0 - production release gate

## Status

PLANNED

## Goal

Harden manageCallAI against telecom-specific fraud and abuse in production:
toll fraud, SIP scanning, outbound bursts, runtime token abuse, webhook replay,
AI/MCP misuse, and tenant-level resource exhaustion.

## Context

The platform already has strong direction for outbound policy, runtime token
hardening, webhook signing, API key capabilities, and rate limits. Production
requires these controls to be complete, tested, observable, and suitable for
multi-instance API deployments.

## Depends On

- `SLICE-44-production-readiness-hardening.md`
- `SLICE-45-telecom-fraud-policy.md`
- `SLICE-46-runtime-secret-hardening.md`
- `SLICE-48-security-alert-rules.md`
- `SLICE-53-production-deployment-and-network-hardening.md`

## Scope

- Move production rate limiting to Redis or another external store for
  multi-instance deployments.
- Add global fallback limits for authenticated REST, platform APIs, runtime APIs,
  webhook APIs, outbound call APIs, auth endpoints, MCP-originated calls, and
  automation API keys.
- Enforce outbound destination policies: country allowlist, area-code allowlist,
  premium-rate/high-risk blocklist, per-tenant limits, per-trunk limits, max call
  duration, and emergency-number rules.
- Add fraud/abuse alerts for failed registrations, outbound bursts, unknown
  destination attempts, runtime auth failures, webhook replay attempts, and MCP
  permission denials.
- Add tests for deny/allow decisions, rate-limit keys, tenant isolation, audit
  actor identity, and alert emission.
- Document emergency operator actions: disable trunk, block tenant outbound,
  rotate runtime token, revoke API key, pause webhook delivery.

## Acceptance Criteria

- Rate limiting works across multiple API instances.
- Outbound abuse decisions are deterministic and tested.
- Fraud-related denials emit audit/alert events without leaking secrets.
- Operators have documented emergency controls.
- Production deployment docs explain required external rate-limit store.
