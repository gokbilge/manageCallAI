# SLICE-07 Inbound IVR And Call Group Projection

## Goal

Move inbound DID routing beyond direct extension bridging to published IVR and call-group targets.

## Status

Implemented in code and docs.

Remaining close-out step:

- rerun the live integration proof on a Docker/FreeSWITCH-capable machine for both:
  - DID -> published IVR
  - DID -> call group

See [../verification/slice-07-live-proof.md](../verification/slice-07-live-proof.md).

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
