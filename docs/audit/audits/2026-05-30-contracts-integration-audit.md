# Audit — contracts-integration-audit — 2026-05-30

**Commit:** 331e0e7  
**Scope:** `packages/contracts`, `packages/sdk`, `apps/mcp`, `apps/worker`, `.github/workflows`,
`scripts/`, `docs/design/domain-model.md`, `apps/api/src/modules/automation/`  
**Build:** clean  
**Lint:** clean  
**Tests:** 371 API + 37 MCP = 408 pass  
**Result:** PASS WITH FINDINGS — 10 findings identified, all resolved in this session

---

## Summary

The contract architecture and CI pipeline are substantially complete. Zod schemas cover all ~30
domain entities, OpenAPI is generated from contracts, the SDK regenerates types, and MCP tools
have vitest-backed contract tests. Ten structural gaps in the integration layer were identified
and resolved in this session.

---

## Findings

### CNT-001: MCP inputSchema drift from Zod contracts

- **Status:** done
- **Severity:** high
- **Location:** `apps/mcp/src/tools/*.ts`
- **Finding:** MCP tool `inputSchema` objects were handwritten JSON Schema. The `decide_approval`
  tool used `decision: enum(['approve', 'reject'])` but `ApprovalDecisionBodySchema` uses
  `enum(['approved', 'rejected'])` — a 1:1 mismatch. No structural validation existed.
- **Fix:** Created `packages/contracts/src/mcp-schemas.ts` using `zod-to-json-schema`. All MCP
  tool files now import `inputSchema` from `@managecallai/contracts`. Added
  `scripts/check-mcp-schemas.mjs` as a structural equality gate. Fixed the `decide_approval`
  enum and corrected the matching tests.

### CNT-002: API key capabilities untyped

- **Status:** done
- **Severity:** high
- **Location:** `packages/contracts/src/schemas/automation.ts`
- **Finding:** `ApiKeySchema.capabilities` was `z.array(z.string())`. No catalog of valid
  values existed in contracts.
- **Fix:** Added `API_KEY_CAPABILITIES as const` (68 values + `'*'` sentinel) and
  `ApiKeyCapabilitySchema = z.enum(API_KEY_CAPABILITIES)` to contracts. Updated
  `ApiKeySchema.capabilities` and `CreateApiKeyBodySchema.capabilities` to use typed arrays.
  Added `scripts/check-api-key-capabilities.mjs` to verify alignment with `capabilities.ts`.

### CNT-003: Worker webhook bodies not contract-validated

- **Status:** done
- **Severity:** medium
- **Location:** `apps/worker/src/modules/webhooks/webhook.controller.ts`,
  `apps/worker/src/modules/webhooks/ivr-flow-webhooks.ts`
- **Finding:** Worker webhook route bodies were manually typed and not connected to
  `packages/contracts`.
- **Fix:** Added `@managecallai/contracts: workspace:*` to worker dependencies. Updated both
  controller files to use `safeParse()` from contract schemas (`CreateExtensionBodySchema`,
  `CreateIvrFlowBodySchema`, `SimulationScenarioSchema`). Invalid bodies now return structured
  400 responses with field-level errors.

### CNT-004: Idempotency key support

- **Status:** already done (prior milestone)
- **Severity:** medium
- **Finding:** DB migration `0032_idempotency_records.sql` and `idempotency.plugin.ts` were
  already implemented. No action required in this session.

### CNT-005: Webhook replay protection missing timestamp check

- **Status:** done
- **Severity:** medium
- **Location:** `apps/api/src/modules/automation/automation.service.ts`
- **Finding:** Webhook delivery sent `X-ManageCall-Signature` without a timestamp. Replay
  protection was structurally impossible for receivers.
- **Fix:** Changed delivery to include `X-ManageCall-Timestamp` (Unix seconds), renamed
  `X-ManageCall-Signature` to `X-ManageCall-Signature-256`, included the timestamp in the
  HMAC payload (`${timestamp}.${body}`). Added `X-ManageCall-Tenant`, `X-ManageCall-Delivery`
  (from `event_id`), and `X-ManageCall-Version: 1` headers.

### CNT-006: PATH_REF_RENAMES accumulation

- **Status:** accepted (deferred)
- **Severity:** low
- **Finding:** 27 manual rename entries in `generate-openapi.mjs` map legacy YAML path names
  to Zod component names. Debt accumulates every time a new path is added in legacy style.
- **Accepted:** The path migration (YAML → `registry.registerPath`) is safe to do incrementally
  per route group. Not addressed in this session — tracked in a follow-up issue.

### CNT-007: Webhook event `payload_json` untyped

- **Status:** done
- **Severity:** low
- **Location:** `packages/contracts/src/schemas/automation.ts`
- **Finding:** `WebhookDeliveryQueueItemSchema.payload_json` was `z.record(z.unknown())`.
  n8n workflows had no contract to parse webhook bodies against.
- **Fix:** Added `WebhookPayloadEnvelopeSchema` and 17 per-event payload schemas (one per
  `WEBHOOK_EVENTS` entry). Added `WEBHOOK_PAYLOAD_SCHEMAS` map. Registered all new schemas
  in `register.ts`. Added `scripts/check-webhook-payloads.mjs` to enforce coverage. Updated
  `enqueueWebhooks` to include `version: 1` in the envelope.

### CNT-008: docker-images.yml missing managecallai-mcp

- **Status:** done
- **Severity:** low
- **Location:** `.github/workflows/docker-images.yml`
- **Finding:** `ci.yml` built `managecallai-mcp` (apps/mcp) in Docker but `docker-images.yml`
  did not include it, so the image was never published.
- **Fix:** Added `managecallai-mcp` / `apps/mcp/Dockerfile` entry to the matrix.

### CNT-009: CONFLICT/FAILED_PRECONDITION absent from coverage check

- **Status:** done
- **Severity:** low
- **Location:** `scripts/check-openapi-coverage.mjs`
- **Finding:** `expectedCodes` array validated 8 of 10 RPC error codes, omitting `CONFLICT`
  and `FAILED_PRECONDITION` which are used by existing routes.
- **Fix:** Added both codes to `expectedCodes`.

### CNT-010: List responses have no pagination envelope

- **Status:** accepted (deferred)
- **Severity:** low
- **Finding:** All list responses return unbounded `{ data: Array<T> }` with no cursor, total,
  or limit/offset fields. Deferred until consumer scale demands it — the shape change is
  breaking for existing SDK callers and should coincide with a v0.2 API version bump.

---

## New CI gates added

| Gate | Script |
|------|--------|
| MCP inputSchema structural equality | `scripts/check-mcp-schemas.mjs` |
| Webhook payload event coverage | `scripts/check-webhook-payloads.mjs` |
| API key capability alignment | `scripts/check-api-key-capabilities.mjs` |

---

## What is in good shape (no action required)

- Contracts Zod schemas cover all ~30 domain entities; all registered in `register.ts`.
- OpenAPI drift gate prevents schema changes from going unnoticed.
- Idempotency plugin (DB migration + Fastify plugin) fully implemented.
- Webhook `event_id` for de-duplication present since migration 0031.
- MCP tests mock `apiCall` — not affected by inputSchema source change.
- All 408 tests pass after this session's changes.
- Build and lint clean across all packages.

---

## Open findings after this audit

| ID | Description | Severity |
|----|-------------|----------|
| CNT-006 | PATH_REF_RENAMES migration to registry.registerPath | low |
| CNT-010 | Pagination envelope for list responses | low |
