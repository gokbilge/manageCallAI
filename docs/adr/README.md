# Architecture Decision Records

This directory contains Architecture Decision Records for `manageCallAI`.

ADRs capture decisions that are important enough to preserve beyond informal discussion. They complement, but do not replace, the canonical design direction in `docs/architecture/source-of-truth.md`.

## ADR Rules

- Create a new ADR when a decision changes architecture, data ownership, interfaces, deployment, tenancy, security model, or operational behavior.
- Do not overwrite old ADRs with new conclusions. Add a new ADR that supersedes or amends the older one.
- Keep ADRs short, decision-focused, and explicit about consequences.

## ADR Index

### Current Technology Decisions

- [ADR-0001: Stock FreeSWITCH](0001-stock-freeswitch.md)
- [ADR-0002: Runtime Adapter in Go](0002-runtime-adapter-go.md)
- [ADR-0003: Fastify Instead of NestJS](0003-fastify-instead-of-nestjs.md)
- [ADR-0004: Lua as Thin Helper Only](0004-lua-thin-helper-only.md)
- [ADR-0007: UI Surfaces and Design System](0007-ui-surfaces-and-design-system.md)
- [ADR-0008: Platform Operator Bootstrap](0008-platform-operator-bootstrap.md)
- [ADR-0009: IVR Desired-State Flow Engine](0009-ivr-desired-state-flow-engine.md)
- [ADR-001: Use Stock FreeSWITCH, No Fork](adr-001-use-stock-freeswitch-no-fork.md)
- [ADR-002: Use Node.js + TypeScript for the Control Plane](adr-002-use-nodejs-typescript-control-plane.md)
- [ADR-003: Use Go for the FreeSWITCH Adapter Service](adr-003-use-go-for-freeswitch-adapter-service.md)
- [ADR-004: Use Lua Only as a Thin In-Switch Helper](adr-004-use-lua-only-as-thin-in-switch-helper.md)
- [ADR-005: Use PostgreSQL Desired-State Model](adr-005-use-postgresql-desired-state-model.md)
- [ADR-006: MCP Must Be Narrower Than the REST API](adr-006-mcp-must-be-narrower-than-rest-api.md)

### Earlier Foundational ADRs

- [ADR-0001: FreeSWITCH Remains the Telecom Runtime](adr-0001-freeswitch-remains-runtime.md)
- [ADR-0002: PostgreSQL Stores Canonical Desired State](adr-0002-postgresql-canonical-desired-state.md)
- [ADR-0003: Business-Level APIs Over Low-Level Telecom Primitives](adr-0003-business-level-api-surface.md)
- [ADR-0004: AI Access Must Be Constrained Through MCP](adr-0004-constrained-ai-access-through-mcp.md)
