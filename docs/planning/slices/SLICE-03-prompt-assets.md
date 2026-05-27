# SLICE-03 Prompt Assets

## Goal

Add prompt assets as first-class desired-state objects that can be referenced safely by IVR flows.

## Scope

- prompt metadata CRUD
- runtime-resolvable prompt URI or storage path model
- active/inactive state
- validation hooks for prompt references

## Depends On

- `SLICE-00`

## Parallel With

- `SLICE-01`
- `SLICE-02`

## Unblocks

- `SLICE-04`
- `SLICE-08`

## Exit Criteria

- flow nodes can reference real prompt records
- prompt lookup is stable enough for runtime resolver use
- prompt existence can be validated

## Out Of Scope

- advanced media processing pipeline
