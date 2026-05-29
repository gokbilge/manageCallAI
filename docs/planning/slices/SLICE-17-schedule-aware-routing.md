# SLICE-17 Schedule-Aware Routing

## Goal

Introduce schedule-aware and condition-aware routing as explicit desired state.

## Status

**PLANNED**

## Scope

- schedules resource with timezone-aware recurring windows
- holiday and one-off override model
- business-hours evaluation in validation, simulation, and runtime resolution
- caller-number and conditional routing extensions where they fit the same model

## Depends On

- `SLICE-07`
- `SLICE-15`

## Parallel With

- `SLICE-16`
- `SLICE-19`

## Unblocks

- business-hours routing
- holiday exceptions
- more realistic production call handling policies

## Exit Criteria

- schedules can be modelled, validated, simulated, and referenced safely
- runtime behavior is pinned to published schedule state for the life of a call
- operator UI exposes schedule configuration clearly enough for production use

## Out Of Scope

- workforce management
- predictive routing
