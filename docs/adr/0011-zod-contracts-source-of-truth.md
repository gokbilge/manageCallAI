# ADR-0011: Zod Contracts Are the API Contract Source of Truth

## Status

Accepted

## Date

2026-05-31

## Context

`manageCallAI` has multiple consumers of the same domain contracts: REST, web UI,
SDK, MCP tools, n8n examples, provider adapters, and runtime-internal endpoints.
If each surface hand-maintains request and response shapes, the system will drift
and AI or workflow tools may accept inputs that the API rejects.

## Decision

Use `packages/contracts` Zod schemas as the canonical API-facing contract source
for business objects, lifecycle operations, webhook payloads, and MCP tool input
schemas where those tools map to API operations.

Generated artifacts such as OpenAPI and SDK types are downstream outputs. They
must be regenerated and checked when schemas change.

## Consequences

- REST, SDK, MCP, and documentation can be checked against one schema source.
- Contract drift becomes a CI failure instead of a runtime surprise.
- Schema changes require explicit regeneration and review of generated OpenAPI.
- Internal repository row shapes may still differ from public schemas, but service
  boundaries must translate deliberately.

## Alternatives Considered

- Treat OpenAPI YAML as the manually edited source of truth.
- Let each app define local DTOs independently.
- Infer public contracts from database migrations.

## Notes

This decision complements ADR-0003, which keeps public API vocabulary at the
business-domain level rather than exposing low-level FreeSWITCH primitives.
