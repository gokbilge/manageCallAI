# 2026-05-29 Hardening Milestone Audit

## Scope

Architecture hardening across five areas: role-model cleanup, MCP contract
alignment, CI telecom safety gates, API module grouping, and DB integrity
hardening.

## Completed items

---

### HM-001: Role-model cleanup

**Status: resolved**

**Problem:** Migration `0018_user_roles.sql` added `users.role` with a CHECK
constraint that excluded `platform_admin`. The `createTenantAndUser` INSERT did
not explicitly set `role = 'tenant_admin'`, relying on the column DEFAULT.
Documentation of the canonical role model (DB vs JWT) was incomplete.

**Changes:**
- `db/migrations/0027_role_model_cleanup.sql`: Drops and re-adds the CHECK
  constraint to allow `platform_admin` as a DB-level safety net. Adds a column
  COMMENT documenting that `platform_admin` is never persisted by normal
  application flows.
- `apps/api/src/modules/auth/auth.repository.ts`: INSERT now explicitly sets
  `role = 'tenant_admin'`.
- `apps/api/src/modules/auth/auth.service.test.ts`: Expanded tests covering
  successful login, role returned by login, touchLastLogin called, tenant_operator
  role returned correctly, and explicit tenant_admin for registration.
- `apps/api/src/modules/auth/capabilities.test.ts`: Expanded to cover all four
  roles across all capability categories, plus fail-closed for unknown/missing roles.
- `docs/security/capability-model.md`: Rewritten to document the canonical role
  model (DB columns, JWT override, legacy tables, fail-closed behavior, condensed
  capability table).

**Residual debt:** The `roles` and `user_roles` tables from the initial schema are
unused. They should be dropped in a future cleanup migration — that is a safe but
non-urgent change.

---

### HM-002: MCP contract alignment

**Status: resolved**

**Problem:** Two MCP server implementations existed (`apps/mcp`, `apps/mcp-server`)
with no documentation of which was canonical. MCP tool inputSchemas for
`simulate_flow` were missing fields from `SimulationScenarioSchema`. The IVR node
type list was duplicated in `ivr-flow.validation.ts` instead of coming from a
shared source.

**Changes:**
- `packages/contracts/src/schemas/ivr-flows.ts`: Added `IVR_NODE_TYPES` constant
  and `IvrNodeType` type. This is now the single source of truth for supported node
  types, shared between the API validator and MCP tool schemas.
- `apps/api/src/modules/ivr-flows/ivr-flow.validation.ts`: Imports `IVR_NODE_TYPES`
  from `@managecallai/contracts` instead of duplicating the list.
- `apps/mcp/package.json`: Added `@managecallai/contracts` as a dependency.
- `apps/mcp/src/tools/ivr-flows.ts`: `simulate_flow` inputSchema expanded to
  include all fields from `SimulationScenarioSchema` (`collected_digits`,
  `force_timeout`, `force_timeout_nodes`, `force_invalid`, `force_invalid_nodes`,
  `variables`). Handler passes all new fields to the API.
- `apps/mcp/src/tools/contract-drift.test.ts` (new): Contract drift enforcement
  tests — verifies `IVR_NODE_TYPES` coverage, `simulate_flow` inputSchema field
  alignment, `request_publish` required fields.
- `apps/mcp/Dockerfile` (new): `apps/mcp` was missing a Dockerfile.
- `docs/planning/slices/SLICE-38-mcp-contract-alignment.md`: Updated to IMPLEMENTED.

**Canonical MCP server:** `apps/mcp` (API-key auth, vitest tests, bin entry).
`apps/mcp-server` is retained for its Docker image but should not receive new tools.

---

### HM-003: CI telecom safety gates

**Status: resolved**

**Problem:** CI only ran syntax check on migrations (not full replay), had no secret
scanning, no dependency vulnerability audit, no explicit Docker build test in the
main CI job, no MCP contract drift CI step, and no IVR simulation regression gate.

**Changes:**
- `.github/workflows/ci.yml`: Restructured into `build-test` and `docker-build`
  jobs. Added: secret scan, full migration replay (`pnpm db:migrate`), dependency
  audit (`pnpm audit --audit-level=high`), MCP contract drift check, IVR simulation
  regression step, runtime XML golden-file test step, FreeSWITCH profile smoke test
  placeholder with documented CI blocker.
- `scripts/check-secrets.mjs` (new): Scans tracked files for hardcoded credentials
  and known demo defaults with precise allowed-path exceptions.
- `scripts/check-mcp-contracts.mjs` (new): CI runner for MCP vitest suite.
- `scripts/check-ivr-simulation.mjs` (new): CI runner for IVR simulation regression.
- `scripts/check-freeswitch-profile.mjs` (new): Local ESL smoke test with documented
  CI blocker (FreeSWITCH cannot run as a GitHub Actions service container without a
  self-hosted runner).
- `apps/mcp/Dockerfile` (new): Enables `managecallai-mcp` Docker build in CI.
- `docs/security/audit-exceptions.md` (new): Documents the dependency audit
  exception process.
- `docs/planning/slices/SLICE-39-ci-telecom-safety-gates.md`: Updated to IMPLEMENTED.

**Remaining CI gap:** FreeSWITCH profile smoke test requires a self-hosted runner.
The deterministic substitute (dialplan golden-file tests) runs in CI today.

---

### HM-004: API module grouping

**Status: resolved**

**Problem:** `apps/api/src/app.ts` had 35+ controller registrations in a flat list
with no organization, making it hard to audit which routes belong to which domain.

**Changes:**
- `apps/api/src/app.ts`: Refactored into four registration functions:
  - `registerCoreDomainModules` — extensions, trunks, phone numbers, prompts, IVR
    flows, call groups, queues, voicemail boxes, inbound/outbound routes, approvals,
    policies, schedules.
  - `registerRuntimeModules` — call events, IVR runtime, outbound calls, recordings,
    recording analysis, prompt generation, IVR AI, FreeSWITCH mod_xml_curl.
  - `registerIntegrationModules` — automation, webhooks, channel accounts, channel
    messages, meeting sessions, export.
  - `registerPlatformModules` — auth, platform, audit, users.
  All route prefixes are preserved exactly as before. Build and tests verify no
  regression.

---

### HM-005: DB integrity hardening

**Status: resolved**

**Problem:** Audit tables (`tenant_audit_log`, `audit_events`) had no database-level
immutability enforcement. Several hot-path queries were missing optimal indexes.
Service-level status transition guards existed but had no dedicated unit tests.

**Changes:**
- `db/migrations/0028_db_integrity_hardening.sql` (new):
  - Hot-path indexes: `call_events (tenant_id, call_id, event_time DESC)`,
    `ivr_flow_sessions (tenant_id, flow_id, status)`, pending approval requests,
    recording analysis backlog, user email lookup, active inbound route fast-path,
    webhook delivery queue, publish records.
  - `tenant_audit_log` and `audit_events` immutability via PostgreSQL rules that
    convert UPDATE and DELETE to no-ops, with explanatory table COMMENTs.
- `apps/api/src/modules/inbound-routes/inbound-route.service.test.ts` (new):
  Dedicated unit tests for `publish`, `rollback`, and `activate` status transition
  guards including tenant consistency checks (`targetExists` called with correct
  `tenantId`, `hasConflictingActiveRoute` called with correct `tenantId`).

---

## Test summary

| Area | Tests run | Result |
|------|-----------|--------|
| Auth service (role model) | 8 | ✓ pass |
| Capabilities (all roles) | 24 | ✓ pass |
| Inbound route service (status transitions) | 9 | ✓ pass |
| MCP tools (incl. contract drift) | 37 | ✓ pass |
| IVR validation + simulation + runtime | included in 281 | ✓ pass |
| All API unit tests | 281 | ✓ pass |
| Go tests (freeswitch-agent) | 6 pkgs | ✓ pass |
| Secret scan | 505 files | ✓ pass |
| TypeScript build | all packages | ✓ pass |
| Lint | all packages | ✓ pass |
| `git diff --check` | | ✓ clean |

## Remaining open items

1. Drop legacy `roles` and `user_roles` tables (non-urgent, requires careful migration
   to ensure no external systems reference them).
2. FreeSWITCH profile smoke test needs a self-hosted CI runner with FreeSWITCH
   available — tracked in SLICE-39.
3. The `pnpm audit` step may surface vulnerabilities as the dependency tree evolves;
   the exception process is documented in `docs/security/audit-exceptions.md`.
