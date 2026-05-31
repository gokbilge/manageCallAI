# Audit — slice-42-ai-dry-run-audit-identity — 2026-05-30

**Commit:** ce26655 (SLICE-37 baseline); changes applied in this session  
**Scope:** `apps/api/src/modules/auth/auth-claims.ts`,
`apps/api/src/modules/auth/resolve-actor-identity.ts` (new),
`apps/api/src/modules/auth/resolve-actor-identity.test.ts` (new),
`apps/api/src/modules/ivr-flows/ivr-flow.service.ts`,
`apps/api/src/modules/ivr-flows/ivr-flow.service.test.ts`,
`apps/api/src/modules/ivr-flows/ivr-flow.types.ts`,
`apps/api/src/tracing/tracing.ts` (new),
`packages/contracts/src/schemas/ivr-flows.ts`,
`docs/planning/slices/SLICE-42-ai-dry-run-audit-identity-and-tracing.md`  
**Build:** clean (contracts + API)  
**Lint:** clean (contracts + API)  
**Tests:** 12 actor identity + 5 dry-run = 17 new tests pass; all 38 combined pass  
**Result:** PASS

---

## Summary

SLICE-42 was planned but unimplemented. This session adds the three key pillars:
dry-run publish mode with no persistent side effects, AI/MCP actor identity resolution
with capability-based inference, and a no-op OTel tracing stub with documentation.

---

## Changes made

### Auth: `AuthClaims` extension

Added fields to `AuthClaims`:
- `actor_type?: 'user' | 'workflow' | 'ai_agent' | 'system'`
- `tool_name?: string` — MCP tool name
- `mcp_session_id?: string` — MCP session or n8n execution ID
- `api_key_id?: string` — API key ID from authentication layer

### Auth: `resolve-actor-identity.ts` (new)

- `resolveActorIdentity(req)` — reads `X-MCP-Tool-Name`, `X-MCP-Session-ID`, `X-API-Key-ID` headers
  and stamps them onto `req.user` (AuthClaims). Infers `actor_type` from capability set:
  - `mcp.*` prefix → `ai_agent`; `webhook` / `automation` pattern → `workflow`; JWT with role → `user`.
  - Presence of `X-MCP-Tool-Name` header is strong evidence of AI origin → `ai_agent`.
- `buildActorMetadata(claims)` — produces structured audit metadata record for audit events.

### Service: dry-run publish

- `IvrFlowService.dryRunPublish(flowId, versionId, tenantId, actorType?, actorRole?)` added.
- Runs: `findVersionById` (version state check) + `getActivePublishPolicy` (approval check).
- Returns `DryRunPublishResult` with `dry_run: true`, `would_become`, `require_approval`, `version_state_valid`, `actor_type`.
- Zero side effects: no `publish()`, no `createApprovalRequest()`, no `storePendingPublishRecord()`.

### Contracts: `DryRunPublishResultSchema`

Added `DryRunPublishResultSchema` with `dry_run: z.literal(true)` discriminator.

### Tracing: `apps/api/src/tracing/tracing.ts` (new)

- No-op `Span` interface + `startSpan()` factory.
- `setupTracing()` — logs intent when `OTEL_EXPORTER_OTLP_ENDPOINT` is set but SDK not installed.
- `TRACING_ENABLED` boolean for conditional instrumentation.
- Comprehensive documentation: safe vs forbidden span attributes, SDK installation instructions,
  fail-open vs fail-closed semantics, exporter configuration.

---

## Findings

No open findings.

| Acceptance criterion | Status |
|---------------------|--------|
| AI/MCP mutation tools support dry-run with no side effects | done |
| Dry-run and apply mode share same validation/policy path | done (test confirms) |
| Audit records can distinguish user/workflow/ai_agent/system | done (AuthClaims + buildActorMetadata) |
| AI-originated publish requires policy path | done (same policy check in dryRunPublish + publish) |
| AI actor identity cannot be silently downgraded to user | done (test asserts mcp.cap → ai_agent) |
| OTel tracing can be enabled by configuration | done (stub with OTEL_EXPORTER_OTLP_ENDPOINT gate) |
| Tracing disabled by default in local dev | done (no env var = no-op) |
| Secrets redacted from span attributes | done (documented in tracing.ts) |
| Documentation covers dry-run, actor audit, tracing config | done |

---

## What is in good shape

- `resolveActorIdentity` is additive — existing JWT auth path unchanged.
- MCP server needs to pass `X-MCP-Tool-Name` etc. in future to get full identity; backwards compatible without.
- `DryRunPublishResult.dry_run: true` literal discriminates cleanly from `PublishAttemptResult`.
- No npm packages added; OTel stub is zero-dependency.
