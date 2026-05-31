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

## Suggested Claude Prompt

```text
You are a senior telecom runtime engineer, CI architect, and FreeSWITCH
integration reviewer.

Repository:
https://github.com/gokbilge/manageCallAI

Task:
Complete SLICE-50: Self-Hosted FreeSWITCH Smoke CI.

Goals:
- Prove API + PostgreSQL + FreeSWITCH + Go agent together in a real runtime
  smoke path.
- Keep the workflow optional for normal PRs but required for beta/release
  candidates.
- Ensure all logs and uploaded artifacts are redacted.

Required work:
1. Inspect current runtime scripts, Dockerfiles, FreeSWITCH config, and
   docs/development/live-freeswitch-*.md.
2. Add or harden a smoke script that verifies:
   - API health
   - DB migrations applied
   - FreeSWITCH directory lookup
   - FreeSWITCH dialplan lookup
   - SIP REGISTER
   - IVR runtime callback
   - Go agent event ingestion
   - observability call timeline query
3. Add `.github/workflows/freeswitch-smoke.yml` for a self-hosted runner label.
4. Make the workflow skip safely when the self-hosted runner is unavailable for
   contributor PRs, but document how release candidates require it.
5. Add redaction checks for smoke logs/artifacts.
6. Update docs/release/release-checklist.md and docs/deployment/local-alpha.md.

Acceptance criteria:
- Self-hosted smoke proves the real runtime loop.
- GitHub-hosted CI remains understandable and green.
- Release checklist includes runtime smoke evidence.
- No raw secrets appear in logs/artifacts.
```

