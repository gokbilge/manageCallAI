# SLICE-07 Inbound IVR And Call Group Projection

## Goal

Move inbound DID routing beyond direct extension bridging to published IVR and call-group targets.

## Status

**CLOSED** — 2026-05-28

E2E proofs passed against a live PostgreSQL DB
(`route-lookup.integration.test.ts`, 15/15 green):

- ✓ DID → published IVR: dialplan returns `luarun managecall_entry.lua` + `managecall_flow_id`
- ✓ DID → call group: dialplan returns `bridge sofia/internal/<ext>@<domain>`

## Scope

- dialplan projection for IVR entry
- dialplan projection for call-group targets
- route target validation
- end-to-end inbound call proof

## Depends On

- `SLICE-05`
- `SLICE-06`

## Parallel With

- none recommended; this is integration-heavy

## Unblocks

- `SLICE-11`

## Exit Criteria

- DID can target published IVR
- DID can target call group
- inbound runtime path is proven with stock FreeSWITCH

## Out Of Scope

- outbound routing
