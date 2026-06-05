# Audit: Issue 236 Natural-Language Telecom Reporting

Date: 2026-06-05

## Scope

`v0.6` issue `#236`:

- natural-language reporting API (`POST /reporting/nl-query`)
- bounded query compilation (no raw SQL, no shell)
- capability-gated tenant surface (`tenant.reporting.nl_query`)
- reporting page UI with filter chips, result table, and fail-closed error states

## Findings

### Closed

1. API compiles natural-language questions to parameterized SQL — no user input
   reaches raw SQL text; all filter values are type-checked and enumerated.
2. Unsupported questions (no call terms, SQL injection attempts, unrelated domain)
   fail closed with `NlQueryNotSupportedError` → 400 response with examples.
3. All results carry `is_advisory: true`; endpoint is read-only with no
   state-changing side effects.
4. Endpoint is gated on `tenant.reporting.nl_query` capability; unauthenticated
   requests return 401.
5. Default 24-hour window applied when no time range is specified, bounding
   result set size.
6. UI shows applied filter chips, count badge, and result table. Empty-result
   and no-filter states have explicit copy. Advisory disclaimer is always shown.
7. Supported question classes and non-goals documented in `docs/user/admin-tasks.md`.

### Open

1. Local API integration tests were not run because PostgreSQL was not available
   at `localhost:5432`. CI must provide the pass/fail signal.

## Evidence

- API unit tests (27 cases): `apps/api/src/modules/reporting/reporting.service.test.ts`
- API integration test (5 cases): `apps/api/src/modules/reporting/reporting.integration.test.ts`
- Web tests (14 cases): `apps/web/src/features/reporting/reporting-page.test.tsx`
- Contracts: `packages/contracts/src/schemas/reporting.ts`
- OpenAPI: `docs/api/openapi.yaml` (`/reporting/nl-query`)
- Design coverage: `docs/design/ai-operator-workflows.md` §4.4
- User docs: `docs/user/admin-tasks.md` §4.14

## Follow-up

- Watch CI for `reporting.integration.test.ts`.
- If CI lacks a PostgreSQL service for API integration tests, fix the workflow.
