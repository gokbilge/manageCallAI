# SLICE-41 P1 Leftover Telecom, Ops, And AI Hardening

## Status

**COMPLETED**

Audited 2026-05-30. Telecom/runtime, IVR API hardening, MCP risk classification,
API-key capability enforcement, webhook DLQ/idempotency/event catalog work,
metrics/health/support bundle, and production operations documentation are in
place. Final close-out added per-trunk SRTP policy. Visual builder execution,
live observability, MVP reliability, production readiness, and AI dry-run/tracing
are owned by SLICE-36, SLICE-37, SLICE-43, SLICE-44, and SLICE-42 respectively.

## Goal

Finish the P1 items that were not implemented in the runtime-safety foundation.
`SLICE-40` added outbound destination safety and queue runtime policy. This slice
covers the remaining telecom deployment, IVR builder/runtime, AI/MCP, automation,
and operations hardening work.

## Depends On

- `SLICE-40-p1-runtime-and-operations-hardening.md`
- `SLICE-38-mcp-contract-alignment.md`
- `SLICE-39-ci-telecom-safety-gates.md`

## Telecom / Runtime Scope

- NAT/SIP profile guidance for production deployments.
- TLS/SRTP strategy for production SIP.
- Codec policy management for trunks/routes.
- DTMF mode handling: RFC2833, SIP INFO, and in-band.
- Registration event ingestion as first-class timeline events.
- CDR normalization and reconciliation.
- Call recording storage lifecycle: retention, deletion, access control, media
  location safety.
- Voicemail storage and retrieval beyond voicemail dialplan routing.

## IVR Builder / Runtime Scope

- Complete the visual IVR builder user workflow.
- Enforce the node support matrix in shared code and UI controls.
- Graph diff preview before publish.
- Simulation coverage report showing tested and untested branches.
- Prompt playback validation: existence, format, sample rate, and duration.
- Loop detection and max retry policies per node.
- Localization and multilingual prompt sets.
- Runtime failure fallback nodes.
- Live session debugger with current node, last DTMF, variables, and next action.
- Rollback smoke test proving runtime lookup consumes the rolled-back active
  version.

## AI / MCP Scope

- Remove access tokens from MCP tool arguments in favor of server config/session
  auth.
- Tool-level risk classification.
- Dry-run mode for AI mutations.
- Human-readable and machine-readable diff for AI-proposed flow edits.
- Policy-based publish approval for AI-originated changes.
- MCP audit actor identity distinct from normal user tokens.
- Prompt-injection protection for AI-assisted IVR content.
- Capability-limited API keys for AI agents, including regression tests for denied
  scopes.
- Replay-safe idempotency keys for AI mutations.

## Automation / n8n Scope

- Official n8n node package scaffold or documented importable workflow templates.
- Webhook signing verification tests and consumer docs.
- Webhook delivery retry policy visibility.
- Dead-letter queue surface for abandoned webhook deliveries.
- Idempotent webhook event IDs.
- Business event catalog with schemas.
- Workflow examples: missed call, voicemail received, IVR publish failed, route
  rollback, and recording transcribed.

## Operations Scope

- Structured logging with tenant, call, and request correlation IDs.
- Prometheus metrics endpoint.
- Health checks per subsystem: DB, FreeSWITCH ESL, worker, webhook queue.
- Tracing across API -> FreeSWITCH agent -> runtime callback.
- Backup/restore docs for PostgreSQL and media.
- Production deployment guide.
- Upgrade/migration playbook.
- Admin bootstrap flow without default admin credentials.
- Support bundle export with config summary, recent errors, call timeline, version
  info, and secret redaction.
- SLOs for runtime lookup endpoints.

## Acceptance Criteria

- Each telecom/runtime feature has either implemented config/API support or
  production documentation with explicit operational constraints.
- IVR builder/runtime work is covered by API, UI, and runtime tests where code is
  implemented.
- MCP tools no longer pass user access tokens as tool arguments.
- AI-originated mutations are auditable, dry-runnable, idempotent, and approval-gated
  by policy.
- Webhook consumers can verify signatures and de-duplicate event IDs.
- Operations docs cover deployment, upgrade, backup/restore, health, metrics, and
  support diagnostics.
- CI runs any new deterministic tests added by this slice.
