# SLICE-08 Visual Builder

## Goal

Replace raw `graph_json` editing with a real visual flow authoring experience.

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

## Status

- Implemented: first React Flow-based builder surface in the tenant IVR flow detail page
- Still later:
  - collaborative editing
  - richer node families beyond the MVP runtime set
