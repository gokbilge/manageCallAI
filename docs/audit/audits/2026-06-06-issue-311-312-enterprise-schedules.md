# Audit: issue-311-312-enterprise-schedules

Date: 2026-06-06

Scope:

- `#311` schedule-group and holiday-calendar model
- `#312` override and expiry workflow

Checks performed:

- schedule service validation tests
- schedule business-hours utility tests
- adjacent IVR/runtime/repository unit coverage
- API build
- web schedule page test
- web production build
- workspace lint

Findings:

- No open findings for the implemented `#311` and `#312` scope.
- `#313` remains open. Current override evaluation is timezone-correct for the
  referenced schedule aggregate, but route and IVR consumers are not yet lifted
  into the broader per-site timezone-aware semantics planned for that issue.

Evidence:

- `pnpm --filter @managecallai/contracts build`
- `pnpm --filter @managecallai/api test -- schedule.util.test.ts schedule.service.test.ts`
- `pnpm --filter @managecallai/api test -- ivr-runtime.service.test.ts ivr-flow.service.test.ts repository-coverage.test.ts`
- `pnpm --filter @managecallai/api build`
- `pnpm --filter @managecallai/web test -- schedules-page.test.tsx`
- `pnpm --filter @managecallai/web build`
- `pnpm lint`
