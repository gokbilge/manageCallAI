# SLICE-06 Call Groups

## Goal

Add call groups / ring groups as desired-state targets above simple extension transfer.

## Scope

- call-group CRUD
- extension membership model
- simple strategies such as `simultaneous` and `sequential`
- validation for group membership and active state

## Depends On

- `SLICE-00`

## Parallel With

- `SLICE-04`
- `SLICE-08`

## Unblocks

- `SLICE-07`

## Exit Criteria

- inbound routing and IVR can safely target a call group
- group membership changes remain desired-state, not raw dialplan edits

## Out Of Scope

- full queue engine
- agent states
- wallboard logic
