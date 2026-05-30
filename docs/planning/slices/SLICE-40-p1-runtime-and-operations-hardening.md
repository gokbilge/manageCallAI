# SLICE-40 P1 Runtime And Operations Hardening

## Status

**PARTIALLY IMPLEMENTED - RUNTIME SAFETY FOUNDATION**

Audited 2026-05-30. Queue runtime policy, outbound route safety, destination
allow/block lists, emergency/premium blocking, and API-key capability contracts are
implemented. Remaining P1 work is split across SLICE-41 and SLICE-42.

## Goal

Turn the P1 telecom/runtime, IVR runtime, automation, AI/MCP, and operations
backlog into enforceable contracts instead of loose documentation.

## Implemented Foundation

- Queue desired-state behavior now includes retry delay, maximum wait,
  music-on-hold, and overflow target fields.
- IVR runtime queue actions carry queue behavior fields alongside member targets.
- Outbound dispatch fails closed when no active outbound route matches.
- Outbound routes can define destination allowlists and blocklists.
- Emergency and known premium-rate destinations are blocked before dispatch.
- API-key capability contracts are exposed in shared schemas.

## Remaining P1 Work

- NAT/SIP profile guide and TLS/SRTP production strategy.
- Codec policy and DTMF mode management.
- Registration event ingestion and CDR reconciliation.
- Recording and voicemail storage lifecycle.
- Visual IVR builder completion, graph diff preview, simulation branch coverage,
  prompt playback validation, loop/retry policy, localization, runtime fallback
  nodes, live debugger, and rollback smoke test.
- MCP session auth, tool risk classification, dry-run mutation mode, AI diff output,
  AI approval policy, prompt-injection defenses, and AI idempotency keys.
- n8n workflow templates, webhook signing verification docs/tests, DLQ visibility,
  idempotent event IDs, and business event schema catalog.
- Structured logs, Prometheus metrics, subsystem health checks, tracing, backup and
  restore docs, production deployment guide, upgrade playbook, admin bootstrap,
  support bundle export, and runtime lookup SLOs.

## Acceptance Criteria

- Every remaining P1 item has either an implemented contract/test or a dedicated
  follow-up slice with a concrete owner and validation path.
- Runtime-facing safety behavior fails closed by default.
- Public API and OpenAPI expose all newly implemented policy fields.
