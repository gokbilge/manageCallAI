# SLICE-05 FreeSWITCH Runtime Loop

## Goal

Connect the runtime resolver to stock FreeSWITCH through the thin Lua boundary.

## Status

Closed.

- implemented thin Lua runtime loop
- documented live FreeSWITCH IVR flow proof
- rerun live proof when runtime packaging changes materially

## Scope

- Lua entry script starts session
- Lua requests next action from backend
- Lua executes constrained actions only
- Lua reports results back
- runtime events remain observable

## Depends On

- `SLICE-04`

## Parallel With

- `SLICE-08` can start once the runtime contract is stable

## Unblocks

- `SLICE-07`
- final live IVR runtime proof

## Exit Criteria

- live inbound call can enter a published IVR
- at least one `play_collect -> switch -> transfer` path is proven
- runtime logs and events correlate cleanly to flow session state

## Out Of Scope

- rich media features
- queues and voicemail
