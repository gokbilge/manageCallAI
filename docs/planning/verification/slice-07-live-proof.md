# SLICE-07 Live Proof Checklist

This document is an execution checklist for closing `SLICE-07` cleanly.

Architecture authority remains:

- [../../architecture/source-of-truth.md](../../architecture/source-of-truth.md)

## Purpose

`SLICE-07` is implemented in code, but it should be considered fully closed only
after a live runtime proof is rerun on a machine with:

- Docker daemon available
- stock FreeSWITCH container runnable
- API + PostgreSQL reachable

## Required Proofs

### Proof A — DID to published IVR

1. Start PostgreSQL and run migrations.
2. Start API.
3. Create:
   - tenant
   - prompt asset
   - transfer target extension
   - IVR flow
4. Validate and publish the IVR flow.
5. Create:
   - phone number / DID
   - inbound route targeting the published flow
6. Start FreeSWITCH and `freeswitch-agent`.
7. Place or simulate an inbound call to the DID.
8. Confirm:
   - route lookup resolves `target_type = flow`
   - `managecall_entry.lua` starts `/api/v1/runtime/ivr/sessions`
   - runtime advances through `play_collect -> switch -> transfer`
   - call reaches the target extension

### Proof B — DID to call group

1. Create at least two active extensions.
2. Create a call group with active members.
3. Create an inbound route targeting the call group.
4. Publish the route if required by the route lifecycle.
5. Place or simulate an inbound call to the DID.
6. Confirm:
   - route lookup resolves `target_type = call_group`
   - FreeSWITCH receives the projected behavior for the call group target
   - call reaches the configured member(s) according to strategy

## Evidence To Capture

- `docker compose ps`
- API logs
- FreeSWITCH logs
- `freeswitch-agent` logs if relevant
- one API response example for route lookup
- one API response example for runtime session start/advance

## Closure Rule

`SLICE-07` can be marked fully proven only when both Proof A and Proof B pass in
a live runtime environment.
