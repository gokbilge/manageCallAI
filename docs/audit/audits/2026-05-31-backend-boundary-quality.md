# Audit - backend boundary quality - 2026-05-31

**Commit:** current working tree
**Scope:** API module boundaries, runtime ingest controllers, shared domain
assertions, tenant scoping, publish preconditions, TypeScript strictness, and
test coverage.
**Result:** PASS

## Findings

No open findings.

## Actions Taken

- Added shared domain assertion helpers for tenant scope, active resources,
  publish preconditions, route targets, and version state.
- Extracted voicemail message persistence and business rules from the controller
  into repository and service classes.
- Extracted extension event ingestion persistence and registration projection
  logic from the controller into repository and service classes.
- Reused shared publish/route target assertions in IVR and inbound-route
  services while preserving existing domain error mapping.
- Enabled `noUncheckedIndexedAccess`, `noImplicitReturns`, and
  `noFallthroughCasesInSwitch` for the API TypeScript build.
- Added focused service tests for runtime tenant mismatch, inactive resources,
  missing resources, idempotent replay, and projection failure tolerance.

## Follow-Up Notes

- Remaining lower-risk cleanup candidates: `provider-work`, `recordings`,
  `call-events`, and `freeswitch` controller boundaries.
- `exactOptionalPropertyTypes` is not safe yet because many inferred Zod body
  objects pass explicit `undefined` for optional fields. Enable it in a
  dedicated DTO-normalization pass.

## Validation

- `pnpm --filter @managecallai/api build`
- `pnpm --filter @managecallai/api lint`
- `pnpm --filter @managecallai/api exec vitest run src/modules/voicemail-boxes/voicemail-message.service.test.ts src/modules/extensions/extension-event.service.test.ts src/modules/inbound-routes/inbound-route.service.test.ts src/modules/ivr-flows/ivr-flow.service.test.ts src/modules/runtime/ivr-runtime.service.test.ts`
- `pnpm --filter @managecallai/api test`
