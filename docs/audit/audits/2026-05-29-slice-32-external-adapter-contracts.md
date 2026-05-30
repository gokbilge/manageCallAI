# Audit - slice 32 external adapter contracts - 2026-05-29

**Commit:** uncommitted
**Scope:** SLICE-32 manageCallAI-side channel adapter contracts, outbound adapter
work loop, documentation, OpenAPI, and generated SDK types.
**Result:** PASS WITH FINDINGS

## Checks Run

- `pnpm --filter @managecallai/contracts build` - passed
- `pnpm --filter @managecallai/api build` - passed
- `pnpm --filter @managecallai/api lint` - passed
- `pnpm --filter @managecallai/contracts lint` - passed
- `pnpm --filter @managecallai/api test -- channel-message.service.test.ts` - passed
- `pnpm generate:openapi` - passed
- `pnpm generate:web-types` - passed
- `node scripts/check-openapi-coverage.mjs` - passed, 99 operations
- `pnpm build` - passed
- `pnpm lint` - passed
- `pnpm test` - blocked locally because PostgreSQL was not reachable on port 5432
- `git diff --check` - passed

## Findings

### AUD-2026-05-29-001: Full local integration test suite requires PostgreSQL

- **Status:** open
- **Severity:** low
- **Location:** local workstation
- **Finding:** `pnpm test` fails in API integration tests with
  `ECONNREFUSED 127.0.0.1:5432` because local PostgreSQL is not running.
- **Fix:** Rerun `pnpm test` in CI or on a workstation with the repo PostgreSQL
  service available.
- **Resolved:**

### AUD-2026-05-29-002: Provider implementations remain external placeholders

- **Status:** accepted
- **Severity:** info
- **Location:** `docs/integrations/channel-adapters.md`
- **Finding:** WhatsApp, Telegram, Google Meet, and custom provider adapters are
  documented as placeholders. This is intentional: provider SDKs, token refresh,
  webhook hosting, delivery retries, and compliance behavior belong in independent
  services outside `apps/api`.
- **Fix:** No code change required for this slice.
- **Resolved:** accepted

## Notes

- The manageCallAI API now stores queued outbound channel work, lets independent
  adapters claim one item at a time, and accepts sent/failed delivery results.
- Runtime-token authenticated inbound ingestion now carries explicit `tenant_id`.
- OpenAPI and SDK output include the new claim/result schemas and paths.
