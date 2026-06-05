# Audit: Issue 233 AI Call Failure Explanation

Date: 2026-06-05

## Scope

`v0.6` issue `#233`:

- `POST /api/v1/calls/explain-failure` — bounded call failure explanation API
- Web UI: Explain button in call detail panel for failed calls
- Deterministic pattern matching against stored call events — no external AI calls

## Findings

### Closed

1. API scopes all event queries by both `call_id` and `tenant_id` — no cross-tenant access possible.
2. Returns 404 (not empty result) when no events found for the call_id in the tenant scope — fails closed.
3. Unsupported or missing failure reasons produce a fallback explanation rather than an empty response.
4. `NORMAL_CLEARING` and related normal hangup causes are explicitly excluded from failure detection.
5. All results carry `is_advisory: true`; endpoint is read-only with no state-changing side effects.
6. Endpoint is gated on `tenant.calls.explain_failure` capability (tenant_operator and above).
7. Web UI shows Explain button only for `status === 'failed'` calls; button is absent for active/completed calls.
8. Web shows loading state, result panel (cause + next action + facts), unavailable message, and error state.
9. Supported failure codes and non-goals documented in `docs/user/admin-tasks.md §4.14`.

### Open

1. Local API integration tests were not run because PostgreSQL was not available at `localhost:5432`. CI must provide the pass/fail signal.

## Evidence

- API unit tests (23 cases): `apps/api/src/modules/call-failure-explanation/call-failure-explanation.service.test.ts`
- API integration tests (5 cases): `apps/api/src/modules/call-failure-explanation/call-failure-explanation.integration.test.ts`
- Web tests (7 new cases): `apps/web/src/features/calls/calls-page.test.tsx`
- Contracts: `packages/contracts/src/schemas/call-failure-explanation.ts`
- OpenAPI: `docs/api/openapi.yaml` (`/calls/explain-failure`)
- Design coverage: `docs/design/ai-operator-workflows.md` §5 (CallFailureExplanationService)
- User docs: `docs/user/admin-tasks.md §4.14`

## Follow-up

- Watch CI for `call-failure-explanation.integration.test.ts`.
- Consider extending explanation with SIP trunk registration status lookups in a future iteration.
