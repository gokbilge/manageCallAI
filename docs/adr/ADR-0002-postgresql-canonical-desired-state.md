# ADR-0002: PostgreSQL Stores Canonical Desired State

## Status

Accepted

## Date

2026-05-26

## Context

The platform needs a canonical source of truth for telecom intent, version history, validation outcomes, simulation results, and audit records.

The runtime system should consume generated active state, but should not be treated as the authoritative source of business intent.

## Decision

PostgreSQL will store the canonical desired state and associated operational metadata for `manageCallAI`.

Published runtime artifacts will be derived from application-managed persisted state rather than manually maintained in FreeSWITCH.

## Consequences

- The application has a durable and queryable source of truth for configuration and lifecycle state.
- Validation, simulation, publish, rollback, and audit workflows can be implemented consistently against one persistence model.
- Runtime drift must be controlled by regeneration and version activation rather than manual changes in the telecom runtime.
- Schema design quality becomes critical because core product behavior depends on the integrity of persisted desired state.

## Alternatives Considered

- Using FreeSWITCH-managed runtime configuration as the primary source of truth
- Using a document store as the primary canonical store for all configuration state

## Notes

This decision does not prevent selective caching or materialized runtime outputs elsewhere, but PostgreSQL remains canonical.
