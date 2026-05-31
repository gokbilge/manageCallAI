# SLICE-50 Self-Hosted FreeSWITCH Smoke CI

## Priority

P0 - public beta gate

## Status

PLANNED

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
- Add an optional GitHub Actions workflow that runs only when the required runner
  label is available.
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

- The smoke workflow is required for beta/release candidates, optional for normal
  contributor PRs.
- The workflow fails non-zero on missing directory/dialplan/runtime/event paths.
- Logs do not expose runtime tokens, SIP passwords, webhook secrets, or JWTs.
- Release checklist records whether the FreeSWITCH smoke ran and which runtime
  versions were used.
