# SLICE-44 Production Readiness Hardening

## Priority

P2 - important

## Status

**PARTIALLY IMPLEMENTED**

Audited 2026-05-30. Production secret enforcement, capability-scoped API keys,
outbound allow/block safety, webhook signing headers, idempotent webhook event IDs,
health/readiness endpoints, Prometheus metrics, support bundles, production
deployment guidance, backup/restore guidance, and migration playbook material are
in place. Remaining work includes endpoint rate-limit coverage, append-only audit
semantics, webhook replay-window verification tests, broader tenant-isolation
coverage, OpenTelemetry tracing, richer subsystem health, media lifecycle
playbooks, restore smoke guidance, and outbound fraud rate controls.

## Goal

Move the product from a reliable MVP into a production-ready telecom control plane
with stronger security controls, operational telemetry, deployment guidance, data
protection, and outbound abuse prevention.

This slice should start after `SLICE-43` proves the MVP runtime path. Production
controls are valuable only when the behavior they guard is already repeatable.

## Depends On

- `SLICE-21-enterprise-and-multi-tenant-hardening.md`
- `SLICE-25-webhook-delivery-queue.md`
- `SLICE-29-outbound-call-execution-hardening.md`
- `SLICE-37-live-observability-cockpit.md`
- `SLICE-41-p1-leftover-telecom-ops-and-ai-hardening.md`
- `SLICE-42-ai-dry-run-audit-identity-and-tracing.md`
- `SLICE-43-mvp-demonstrable-reliability.md`

## Scope

### Security and governance

- Add rate limits for auth, runtime, webhook, and outbound initiation endpoints.
- Enforce append-only audit semantics for security-sensitive events.
- Add webhook signing verification tests and replay-window enforcement.
- Add API key scopes with least-privilege defaults and regression tests.
- Add tenant isolation tests for cross-tenant reads, writes, runtime lookups, and
  automation/API-key access.
- Keep production secret enforcement enabled and documented.

### Observability

- Add or harden Prometheus metrics for API, runtime lookup, webhook delivery,
  FreeSWITCH agent, queue state, and outbound dispatch.
- Add OpenTelemetry tracing across API -> FreeSWITCH agent -> runtime callback.
- Add subsystem health checks for DB, FreeSWITCH ESL, worker, webhook queue,
  runtime lookup dependencies, and media storage.
- Define SLOs for runtime lookup endpoints and outbound webhook delivery.

### SIP deployment guidance

- Document production SIP NAT topology, public/private interface assumptions,
  advertised IP behavior, and firewall expectations.
- Document TLS and SRTP strategy for trunks and endpoints.
- Document codec policy and DTMF mode tradeoffs for RFC2833, SIP INFO, and in-band.
- Document safe FreeSWITCH profile exposure, including rate limiting and TDoS edge
  controls.

### Backup, restore, and upgrade operations

- Add PostgreSQL backup and restore playbooks.
- Add media backup and lifecycle playbooks for prompts, recordings, and voicemail.
- Add migration/upgrade playbook with rollback boundaries.
- Add restore smoke test guidance that proves DB state and media references are
  consistent after recovery.

### Outbound fraud prevention

- Add outbound destination allowlists and blocklists where not already enforced.
- Add tenant and trunk rate limits for outbound attempts.
- Add emergency number, premium-rate, and high-risk destination blocking policy.
- Add route-impact analysis before publish for outbound-impacting changes.
- Add audit events and operator visibility for blocked outbound attempts.

## Validation

- `pnpm build`
- `pnpm lint`
- `pnpm test`
- DB migration replay
- tenant isolation integration tests
- webhook signature and replay tests
- API key scope regression tests
- dependency vulnerability audit
- secret scan
- runtime lookup SLO smoke test
- local or self-hosted FreeSWITCH profile smoke where SIP/media is required

## Acceptance Criteria

- Production deployments fail closed on default or missing secrets.
- Auth, runtime, webhook, and outbound endpoints have rate limits with tests.
- Audit records for security-sensitive actions are append-only at service and DB
  boundaries.
- Webhook consumers can verify signatures and reject replayed deliveries.
- API keys are scoped, least-privilege by default, and denied-scope paths are tested.
- Operators have metrics, traces, and subsystem health checks for live runtime
  diagnosis.
- SIP/TLS/SRTP/NAT, backup/restore, migration, and outbound fraud-prevention docs
  are sufficient for a first production deployment.

## Out Of Scope

- SOC 2 or ISO 27001 certification.
- Billing-grade fraud analytics.
- Multi-region active-active FreeSWITCH orchestration.
- Hosted observability backend selection.
