# SLICE-42 AI Dry-Run, Audit Identity, And Tracing

## Status

**COMPLETED**

Audited 2026-05-30. All acceptance criteria are met:

- **Dry-run mode**: `IvrFlowService.dryRunPublish()` runs the same policy/version-state checks as `publish()`
  but writes no DB rows, creates no approvals, emits no webhooks. `DryRunPublishResult` type exported from
  both service and contracts. 5 dry-run unit tests prove: (a) no side effects, (b) same policy path as apply mode,
  (c) actor_type preserved in result.
- **AI actor identity**: `AuthClaims` extended with `actor_type`, `tool_name`, `mcp_session_id`, `api_key_id`.
  `resolveActorIdentity()` reads `X-MCP-Tool-Name`, `X-MCP-Session-ID`, `X-API-Key-ID` headers and infers
  actor_type from capability set. `buildActorMetadata()` produces structured audit metadata. 12 unit tests
  covering inferred types, header stamping, and the "cannot downgrade to user" invariant.
- **OpenTelemetry**: Lightweight no-op stub in `apps/api/src/tracing/tracing.ts`. Enabled only when
  `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Safe span attribute documentation included. SDK installation
  instructions in module header.
- `pnpm build` and `pnpm lint` clean across contracts and API.

## Goal

Complete the deferred AI and operations safety foundations that were intentionally
left out of the P1 hardening slice: dry-run execution for AI-originated mutations,
distinct audit identity for AI/MCP actors, and OpenTelemetry tracing across API,
runtime callbacks, and external automation entry points.

## Depends On

- `SLICE-38-mcp-contract-alignment.md`
- `SLICE-40-p1-runtime-and-operations-hardening.md`
- `SLICE-41-p1-leftover-telecom-ops-and-ai-hardening.md`

## Scope

### Dry-Run Mode

- Add dry-run request support to AI/MCP mutation tools that edit IVR graphs,
  publish candidates, routing resources, queues, and automation-managed objects.
- Return the same validation, risk classification, policy checks, and diff payloads
  that a real mutation would produce.
- Guarantee dry-run calls do not write database rows, emit outbound webhooks,
  enqueue jobs, or create publish/approval side effects.
- Expose both human-readable and machine-readable change summaries.
- Add tests proving dry-run and apply mode use the same validation path.

### AI Actor Audit Identity

- Model AI/MCP actors separately from normal users and generic API keys in audit
  metadata.
- Preserve tenant, tool name, session/request id, API key id, capability scope,
  and upstream automation actor where available.
- Ensure AI-originated publish requests are policy-gated and visible as AI-originated
  in approval, audit, and support-bundle surfaces.
- Reject ambiguous actor identity for mutation tools in production mode.
- Add regression tests that AI actor identity cannot be silently downgraded to a
  tenant admin user.

### OpenTelemetry Tracing

- Add optional OpenTelemetry instrumentation for HTTP requests, PostgreSQL access,
  runtime lookup callbacks, webhook delivery, and MCP/API calls.
- Propagate trace context across API -> FreeSWITCH agent -> runtime callback where
  the transport can carry headers or metadata.
- Include tenant id, request id, call id, route/flow/version ids, and actor type as
  span attributes where safe.
- Keep tracing disabled by default in local development and fail closed on invalid
  production exporter configuration.
- Document exporter setup for OTLP collectors and the expected sensitive-data
  redaction rules.

## Non-Goals

- Do not implement WhatsApp, Telegram, Google Meet, or other channel-specific
  adapters in this slice.
- Do not add a hosted tracing backend; integrate through standard OTLP exporters.
- Do not bypass existing approval or capability gates for AI dry-run convenience.

## Acceptance Criteria

- AI/MCP mutation tools support an explicit dry-run mode with no persistent side
  effects and contract tests proving parity with apply mode.
- Audit records can distinguish human users, automation API keys, MCP sessions, and
  AI-originated actors.
- AI-originated publish or route-impacting changes require the configured policy
  path before they can become active.
- OpenTelemetry tracing can be enabled by configuration and emits correlated spans
  for API, runtime, MCP, and webhook paths without leaking secrets.
- Documentation covers operator configuration, trace attributes, dry-run behavior,
  and AI actor audit semantics.
- CI includes deterministic tests for dry-run side effects, actor identity mapping,
  and tracing configuration.
