# SLICE-04 IVR Runtime Resolver

## Goal

Implement the backend execution loop that resolves a pinned published flow into constrained runtime actions.

## Status

Completed.

## Scope

- create flow session
- resolve first action
- accept action result
- resolve next action
- pin published version per call
- correlate `call_id`, `tenant_id`, and version

## Depends On

- `SLICE-00`
- `SLICE-03`

## Parallel With

- early `SLICE-06` schema work is possible, but runtime integration should wait

## Unblocks

- `SLICE-05`
- `SLICE-08`
- `SLICE-09`
- `SLICE-10`

## Exit Criteria

- backend can execute `start`, `play_prompt`, `play_collect`, `switch`, `transfer_extension`, `hangup`
- per-call version pinning is real
- runtime action contract is documented and tested

## Out Of Scope

- queue runtime
- voicemail runtime
- AI voice runtime
