# Audit: Issues 311 and 312 Enterprise Schedules

Date: 2026-06-06

Scope:

- `#311` `v0.6.7: schedule-group and holiday-calendar model`
- `#312` `v0.6.7: override and expiry workflow`

## Result

PASS

## What was checked

- database migration ordering and naming for the new enterprise schedule tables
- contract registration, OpenAPI regeneration, and SDK regeneration
- schedule service validation and lifecycle behavior
- repository-path coverage for schedule group, holiday calendar, and override persistence
- web UI coverage for the enterprise schedules page
- lint across the workspace after the new schedule surfaces landed

## Commands

- `pnpm check:migrations`
- `pnpm --filter @managecallai/contracts build`
- `pnpm generate:openapi`
- `pnpm --filter @managecallai/sdk build`
- `pnpm --filter @managecallai/api test -- src/modules/schedules/schedule.service.test.ts src/modules/schedules/schedule.util.test.ts`
- `pnpm --filter @managecallai/api test -- src/modules/repository-coverage.test.ts`
- `pnpm --filter @managecallai/web test -- src/features/schedules/schedules-page.test.tsx`
- `pnpm lint`

## Findings

- No blocking findings in the implemented scope.

## Notes

- The existing warning in `apps/web/src/features/ai/incident-investigation-page.tsx` remains present during `pnpm lint`; it predates this change and did not block the new schedule work.
- Local repository-coverage execution required standard test env vars (`DATABASE_URL`, `JWT_SECRET`, `RUNTIME_API_TOKEN`, `SIP_SECRET_MASTER_KEY`, `SIP_SECRET_KEY_ID`) to be set before running the API test file.
