# Audit - issue-252-ai-policy-framework - 2026-06-05

**Commit:** pending
**Scope:** `v0.6.1` provider-backed AI policy foundation (`#252`)
**Result:** PASS WITH FINDINGS

## Findings

### AUD-2026-06-05-001: Provider-backed AI policy is now API-owned and enforced on current provider-neutral AI entry points

- **Status:** done
- **Severity:** medium
- **Location:** `apps/api/src/modules/ai-policy/*`, `apps/api/src/modules/provider-work/*`, `db/migrations/0055_ai_provider_policy.sql`
- **Finding:** Before this slice, provider-backed AI execution was represented only by optional `provider_hint` fields. There was no platform policy, no tenant opt-in layer, and no deterministic fallback enforcement when provider-backed execution was not allowed.
- **Fix:** Added `AiPolicyService`, platform and tenant policy endpoints, tenant override persistence, provider-backed capability checks, request-time audit events, and fallback-to-`auto` behavior for runtime IVR AI requests.
- **Resolved:** pending

### AUD-2026-06-05-002: Local integration validation could not run because no PostgreSQL/Docker runtime was available on this workstation

- **Status:** accepted
- **Severity:** low
- **Location:** local environment only
- **Finding:** `pnpm db:migrate` and API integration tests requiring PostgreSQL could not run locally because Docker Desktop / local PostgreSQL was unavailable (`ECONNREFUSED 127.0.0.1:5432` and missing Docker engine pipe).
- **Fix:** Keep unit coverage and full workspace build/lint green locally, then rely on CI database-backed jobs to validate migration and integration behavior before merge.
- **Resolved:** pending
