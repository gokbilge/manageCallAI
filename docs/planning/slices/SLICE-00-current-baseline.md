# SLICE-00 Current Baseline

## Goal

Freeze what is already proven so later slices build on it instead of reopening it.

## Status

Completed.

## Proven Scope

- auth and tenant bootstrap
- extension CRUD
- encrypted SIP credentials
- FreeSWITCH directory XML
- SIP registration against stock FreeSWITCH
- event ingestion through ESL agent
- phone number and inbound route foundations
- inbound dialplan XML projection to extension targets
- IVR flow CRUD, validation, simulation, and approval-aware publish attempts

## Depends On

None.

## Unblocks

All later slices.

## Parallel With

Not applicable.

## Exit Criteria

- CI remains green
- docs remain aligned
- no regressions in current runtime proof
