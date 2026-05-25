# ADR-005: Use PostgreSQL Desired-State Model

## Status

Accepted

## Date

2026-05-26

## Context

The platform requires a canonical source of truth for telecom intent, version history, validation outcomes, simulations, approvals, publishes, and auditability.

Runtime state in FreeSWITCH should be derived from application-managed desired state rather than serving as the primary business record.

## Decision

`manageCallAI` will use PostgreSQL as the canonical desired-state store.

Desired state is written to PostgreSQL first, and published runtime artifacts are derived from that stored state.

## Consequences

- Desired state, lifecycle state, and audit state are centralized in one canonical store.
- Publish and rollback can be modeled as explicit application-level operations.
- Runtime drift must be handled through regeneration and controlled activation rather than manual switch edits.
- Schema quality and versioning discipline become critical to platform correctness.

## Alternatives Considered

- Treating FreeSWITCH runtime configuration as the primary source of truth
- Using a non-relational primary store for all configuration state

## Notes

This ADR supersedes [ADR-0002](adr-0002-postgresql-canonical-desired-state.md) as the more explicit desired-state formulation.
