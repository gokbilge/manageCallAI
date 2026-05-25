# ADR-0001: FreeSWITCH Remains the Telecom Runtime

## Status

Accepted

## Date

2026-05-26

## Context

`manageCallAI` is intended to provide a safe telecom control plane, not to replace an existing telecom engine.

The system needs mature SIP signaling, media handling, and call execution capabilities without rebuilding those concerns inside the application layer.

## Decision

FreeSWITCH remains the runtime media and signaling engine.

`manageCallAI` will sit above FreeSWITCH as the management, orchestration, validation, API, workflow, and safety layer.

## Consequences

- The project can focus on control-plane behavior instead of implementing a telecom engine.
- Runtime integration becomes a first-class architectural concern.
- The platform must translate business-level desired state into FreeSWITCH-compatible artifacts.
- Some architecture decisions will remain constrained by FreeSWITCH integration patterns and runtime behavior.

## Alternatives Considered

- Building a new telecom runtime inside `manageCallAI`
- Treating FreeSWITCH as optional rather than foundational for MVP

## Notes

This decision is foundational for the current MVP and aligned with `docs/ProjectSourceOfTruth.md`.
