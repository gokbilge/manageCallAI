# ADR-0014: Publishable Objects Follow a Shared Lifecycle

## Status

Accepted

## Date

2026-05-31

## Context

Inbound routes, IVR flows, and future telecom configuration objects need safe
mutation, preview, publication, and rollback. Without a shared lifecycle,
business logic will fragment across services, UI affordances, MCP tools,
workflow templates, and runtime projection code.

## Decision

Publishable objects follow a shared lifecycle:

1. Draft stores proposed desired state.
2. Validation checks structure, references, tenant scope, policy, and runtime
   constraints.
3. Simulation previews behavior without activating runtime state.
4. Approval or policy gates may be required before activation.
5. Publish atomically marks a version active for runtime consumption.
6. Runtime projection derives artifacts from the active published version.
7. Rollback publishes or reactivates a previous eligible version and records the
   rollback as a lifecycle event.

Services own lifecycle logic. SQL, Lua, MCP, n8n, and FreeSWITCH must not
implement their own lifecycle shortcuts.

## Consequences

- UI, REST, MCP, SDK, and n8n can present one lifecycle vocabulary.
- Runtime state is reproducible from PostgreSQL and active versions.
- Rollback is auditable and deterministic.
- Each publishable object must pay the cost of versioning, validation, and
  simulation support before runtime activation.

## Alternatives Considered

- Directly editing active runtime configuration.
- Treating rollback as manual database repair.
- Letting each object define unrelated state-machine vocabulary.

## Notes

See `docs/architecture/publishable-object-lifecycle.md` for contributor guidance.
