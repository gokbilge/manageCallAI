# ADR-0009: IVR Desired-State Flow Engine

**Status:** Accepted

## Context

`manageCallAI` needs IVR programmable by UI, n8n, and MCP without exposing
telecom internals as the primary model.

## Decision

Represent IVR as tenant-scoped desired-state flow graphs with immutable
versions, validation, simulation, publish, and rollback. FreeSWITCH executes
only published state through adapter and runtime endpoints.

## Consequences

Positive:

- AI-safe
- n8n-compatible
- auditable
- rollbackable
- FreeSWITCH remains stock
- future visual builder is natural

Tradeoffs:

- validator and simulator must exist
- runtime resolver is required
- raw FreeSWITCH XML cannot be the source of truth

## Future

- visual builder
- MCP tools
- n8n examples
- AI-assisted draft generation
- richer node types
