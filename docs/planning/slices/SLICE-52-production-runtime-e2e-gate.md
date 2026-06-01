# SLICE-52 Production Runtime E2E Gate

## Priority

P0 - production release gate

## Status

COMPLETED

## Goal

Turn the API-only demo loop and self-hosted FreeSWITCH smoke path into a
production release gate with sanitized evidence.

## Context

The project already proves the control-plane lifecycle in normal CI and can run
FreeSWITCH smoke tests on a dedicated runner. Production readiness needs one
named gate that release managers can run against a real deployment and attach to
release evidence.

## Scope

- Add `pnpm production:e2e` for a live deployment runtime journey.
- Verify API health, tenant bootstrap, extension directory lookup, IVR
  validate/simulate/publish, inbound route publish, dialplan lookup, IVR runtime
  session start, event ingest, and tenant query.
- Write sanitized JSON evidence under `artifacts/production-e2e/`.
- Update the self-hosted FreeSWITCH workflow to run the production E2E script
  and upload evidence.
- Add log redaction for smoke output.
- Document how release candidates record runtime versions and evidence.

## Acceptance Criteria

- The gate fails non-zero when any live-call-impacting step fails.
- Evidence contains IDs and step statuses but no runtime tokens, JWTs, SIP
  passwords, webhook secrets, or database credentials.
- Normal contributor CI remains GitHub-hosted and deterministic.
- Production release candidates require either a passing self-hosted workflow or
  a documented manual run with attached evidence.

## Dependencies

- Depends on `SLICE-50` self-hosted FreeSWITCH smoke CI.
- Feeds `SLICE-55` load/soak testing.
