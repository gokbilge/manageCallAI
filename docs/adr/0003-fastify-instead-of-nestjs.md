# ADR-0003: Fastify Instead of NestJS

## Status

Accepted

## Date

2026-05-26

## Decision

Use Fastify directly for the control-plane API instead of NestJS.

## Rationale

- The API is still early and benefits from a smaller abstraction surface.
- Fastify keeps request handling, plugins, auth hooks, and schema validation explicit.
- The team needs predictable low-level control for telecom-facing runtime endpoints such as XML directory lookup and internal ingest routes.
- Avoiding NestJS decorators and framework structure reduces indirection while the domain model and boundaries are still settling.

## Consequences

- We own more application wiring ourselves.
- Module boundaries must stay disciplined without framework conventions doing it for us.
- If the API grows substantially, this decision can be revisited with a superseding ADR.
