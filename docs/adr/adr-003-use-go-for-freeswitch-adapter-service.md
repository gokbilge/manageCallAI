# ADR-003: Use Go for the FreeSWITCH Adapter Service

## Status

Accepted

## Date

2026-05-26

## Context

The FreeSWITCH adapter service is responsible for runtime-facing integration concerns such as event ingestion, control coordination, and interaction with supported FreeSWITCH extension interfaces.

This layer benefits from a language well-suited to operational tooling, concurrency, straightforward deployment, and long-running service behavior.

## Decision

The FreeSWITCH adapter service will use Go.

This service will sit between the `manageCallAI` control plane and stock FreeSWITCH.

## Consequences

- Runtime event and control integration is isolated from the main application stack.
- The adapter can be deployed as a compact standalone service with strong operational characteristics.
- The system becomes intentionally polyglot, which requires clear interface contracts between the Node.js control plane and the Go adapter.
- Adapter responsibilities must remain integration-focused rather than absorbing business logic that belongs in the control plane.

## Alternatives Considered

- Using Node.js + TypeScript for the adapter service
- Embedding more runtime-facing logic directly inside FreeSWITCH

## Notes

This ADR does not prevent future helper tools in Node, but Go is the selected primary implementation language for the adapter service.
