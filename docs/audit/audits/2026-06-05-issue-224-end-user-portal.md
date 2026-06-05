# Audit: Issue 224 End-User Portal Completion

Date: 2026-06-05

## Scope

- `/api/v1/me/*` self-service expansion
- end-user route and navigation handling in the web app
- end-user UI for voicemail, call history, devices, DND, forwarding, and SIP reset

## Findings

### Closed

1. **End-user route and navigation were incomplete.**
   - Added `end_user` handling in web session/capability logic.
   - Added route protection so `end_user` actors are redirected away from tenant
     admin pages and land on `/tenant/me`.

2. **Self-service API stopped at DND and call forward.**
   - Added owned-resource endpoints for voicemail list/playback/read/delete,
     call history, device registrations, and SIP credential reset.

3. **Device status relied on a missing projection table migration.**
   - Added `extension_registrations` schema creation in migration `0053`.

4. **No user-facing guide existed for end users.**
   - Added `docs/user/end-user-self-service.md`.

### Remaining

1. **Voicemail PIN change remains deferred.**
   - Design doc still lists it, but this slice did not implement it.

2. **Runtime evidence remains deferred.**
   - The product still needs live proof that DND/forward changes are consumed by
     FreeSWITCH in target environments.

## Validation

Passed locally:

- `pnpm --filter @managecallai/api build`
- `pnpm --filter @managecallai/api test -- src/modules/self-service/self-service.service.test.ts`
- `pnpm --filter @managecallai/web test -- src/features/user/self-service-page.test.tsx`
- `pnpm --filter @managecallai/web test -- src/components/layout/app-sidebar.test.tsx src/app/router.test.tsx src/lib/permissions/capabilities.test.ts`
- `pnpm --filter @managecallai/web build`

Not run successfully in this session:

- `apps/api` self-service integration tests require PostgreSQL at `127.0.0.1:5432`
  and failed locally with `ECONNREFUSED`.

## Outcome

Issue `#224` is implementable and reviewable as a contained `v0.5` slice, with
one known environment-dependent gap in local API integration testing.
