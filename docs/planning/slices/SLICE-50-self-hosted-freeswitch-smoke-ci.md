# SLICE-50 Self-Hosted FreeSWITCH Smoke CI

## Priority

P0 - public beta gate

## Status

COMPLETED

## Goal

Add a release smoke path that proves API + PostgreSQL + FreeSWITCH + Go agent
work together on a self-hosted runner or dedicated runtime test host.

## Context

GitHub-hosted service containers are not reliable for full FreeSWITCH SIP/media
smoke tests because of host networking, RTP/SIP port behavior, startup timing,
and runtime privileges. XML golden tests are valuable but do not prove real
runtime integration.

## Scope

- Define a self-hosted runner profile for FreeSWITCH smoke tests.
- Add a GitHub Actions workflow that runs on the required self-hosted runner for
  release and RC branches.
- Boot API, PostgreSQL, FreeSWITCH, and the Go agent.
- Verify directory lookup.
- Verify dialplan lookup.
- Verify SIP REGISTER.
- Verify IVR runtime callback.
- Verify event ingestion.
- Verify observability call timeline.
- Upload logs/artifacts with secrets redacted.
- Document how to run the same smoke locally.

## Acceptance Criteria

- The smoke workflow is required for beta/release candidates on `release/**` and
  `rc/**`, while normal contributor PRs continue using deterministic hosted CI.
- The workflow fails non-zero on missing directory/dialplan/runtime/event paths.
- Logs do not expose runtime tokens, SIP passwords, webhook secrets, or JWTs.
- Release checklist records whether the FreeSWITCH smoke ran and which runtime
  versions were used.

## Implementation Notes

- `.github/workflows/freeswitch-smoke.yml` runs on pushes to `release/**` and
  `rc/**`, and on PRs targeting those branches.
- Release branch protection or repository rulesets must require the
  `FreeSWITCH runtime smoke` status check.
- Missing self-hosted runner capacity blocks release promotion by leaving the
  required check pending.
