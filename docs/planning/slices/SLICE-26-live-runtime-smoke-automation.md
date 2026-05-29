# SLICE-26 Live Runtime Smoke Automation

## Goal

Turn the manual live FreeSWITCH proof into a repeatable smoke command that validates
the release runtime path end to end.

## Status

**PLANNED**

## Context

The repository has documented live runtime proofs and scripts, but release confidence
still depends on manual verification across API, worker, FreeSWITCH, Lua helper, and
the FreeSWITCH agent. A release should include one command that proves the real runtime
loop is healthy in a clean environment.

## Scope

- Add a live smoke script that provisions a tenant, extension, inbound DID route, prompt
  reference, and published IVR flow.
- Verify FreeSWITCH directory lookup for the extension.
- Verify inbound route lookup resolves to the published IVR or target.
- Execute a live IVR path through the runtime loop where practical in the local stack.
- Verify runtime call events and IVR session steps are ingested into Postgres.
- Verify outbound runtime polling remains healthy.
- Produce a concise pass/fail report with IDs and relevant API responses.
- Document prerequisites and expected environment variables.

## Depends On

- `SLICE-05`
- `SLICE-07`
- `SLICE-19`
- `SLICE-23`

## Parallel With

- `SLICE-25`
- `SLICE-27`

## Unblocks

- release candidate validation
- staging deployment verification
- safer FreeSWITCH agent changes

## Exit Criteria

- one documented command can run the live smoke path against the local runtime stack
- the smoke script fails non-zero on missing runtime, auth, route, or event-ingest issues
- generated output includes enough IDs to debug failures
- release runbook references the smoke command

## Out Of Scope

- hosted synthetic monitoring
- carrier/SIP-provider certification
- full load testing
- replacing unit or integration tests
