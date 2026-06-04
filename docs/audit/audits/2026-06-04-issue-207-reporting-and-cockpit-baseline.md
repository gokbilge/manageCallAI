# Audit - issue-207-reporting-and-cockpit-baseline - 2026-06-04

## Scope

- `apps/web/src/lib/calls/call-events-api.ts`
- `apps/web/src/lib/calls/call-events-api.test.ts`
- `apps/web/src/features/calls/calls-page.tsx`
- `apps/web/src/features/calls/calls-page.test.tsx`
- `apps/web/src/features/observability/observability-cockpit-page.tsx`
- `apps/web/src/features/observability/observability-cockpit-page.test.tsx`
- `docs/user/admin-tasks.md`

## What changed

- Added a shared call-event helper layer that derives CDR-style call summaries from normalized call events.
- Reworked the tenant call page from a raw event list into a filterable call-reporting surface with grouped summaries and a selected-call event timeline.
- Expanded the live cockpit with a triage queue, tenant gateway registration visibility, and recent failed-call review.
- Updated the operator admin guide to reflect the new cockpit and call-reporting workflows.

## Validation

- `pnpm --filter @managecallai/web test -- src/lib/calls/call-events-api.test.ts src/features/calls/calls-page.test.tsx src/features/observability/observability-cockpit-page.test.tsx`
- `pnpm --filter @managecallai/web build`
- `pnpm --filter @managecallai/web lint`
- `pnpm --filter @managecallai/web test:coverage`

Coverage after the slice:

- Statements: `85.94%`
- Branches: `81.50%`
- Functions: `82.66%`
- Lines: `86.34%`

## Findings

### Closed

- Operators no longer need to inspect raw JSON event rows to understand recent call outcomes.
- The cockpit now surfaces degraded gateway state and failed-call triage directly in the tenant workspace.
- Web coverage remains above the 80% gate across all four metrics after the new reporting and cockpit paths.

### Remaining

- This slice still depends on normalized call events, not a dedicated persisted CDR model.
- Call-quality analytics, export workflows, and carrier-specific failure drill-down remain future work.
