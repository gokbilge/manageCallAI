# SLICE-08 Visual Builder

## Goal

Replace raw `graph_json` editing with a real visual flow authoring experience.

## Status

Closed.

- React Flow builder shipped in the tenant IVR flow detail page
- validation, simulation, publish, and rollback visibility are integrated into the same operator surface
- collaborative editing and richer future node families remain later product work, not open items for this slice

## Scope

- React Flow canvas
- node palette
- edge editing
- node inspector
- validation and simulation panels
- publish and rollback visibility

## Depends On

- `SLICE-01`
- `SLICE-02`
- `SLICE-03`
- `SLICE-04`

## Parallel With

- `SLICE-09`
- `SLICE-10`

## Unblocks

- operator adoption
- cleaner automation debugging

## Exit Criteria

- users can create and edit MVP node types visually
- validation and simulation are integrated into the same page
- no raw JSON editing is required for normal workflows

## Out Of Scope

- advanced collaborative editing
