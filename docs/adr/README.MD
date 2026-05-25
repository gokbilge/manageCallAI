# Architecture Decision Records

This directory contains Architecture Decision Records for `manageCallAI`.

ADRs capture decisions that are important enough to preserve beyond informal discussion. They complement, but do not replace, the canonical design direction in `docs/ProjectSourceOfTruth.md`.

## ADR Rules

- Create a new ADR when a decision changes architecture, data ownership, interfaces, deployment, tenancy, security model, or operational behavior.
- Do not overwrite old ADRs with new conclusions. Add a new ADR that supersedes or amends the older one.
- Keep ADRs short, decision-focused, and explicit about consequences.

## ADR Index

- [ADR-0001: FreeSWITCH Remains the Telecom Runtime](ADR-0001-freeswitch-remains-runtime.md)
- [ADR-0002: PostgreSQL Stores Canonical Desired State](ADR-0002-postgresql-canonical-desired-state.md)
- [ADR-0003: Business-Level APIs Over Low-Level Telecom Primitives](ADR-0003-business-level-api-surface.md)
- [ADR-0004: AI Access Must Be Constrained Through MCP](ADR-0004-constrained-ai-access-through-mcp.md)
