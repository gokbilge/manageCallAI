# Documentation Index

This directory contains the primary project documentation for `manageCallAI`.

## Core Documents

- [architecture/source-of-truth.md](architecture/source-of-truth.md)
  Canonical product thesis, scope boundaries, and high-level design intent.

- [requirements/srs.md](requirements/srs.md)
  Software Requirements Specification covering functional requirements, non-functional requirements, constraints, assumptions, and acceptance criteria.

- [design/domain-model.md](design/domain-model.md)
  Detailed business domain model covering entities, relationships, lifecycle states, and invariants.

- [api/rest-api.md](api/rest-api.md)
  Initial REST API contract covering resources, lifecycle operations, payload shapes, and error handling.

- [freeswitch-directory-contract.md](freeswitch-directory-contract.md)
  MVP `mod_xml_curl` directory lookup contract between stock FreeSWITCH and the backend.

- [freeswitch-event-mapping.md](freeswitch-event-mapping.md)
  MVP ESL event-ingestion and normalization rules for registration and call lifecycle events.

- [freeswitch-runtime-integration.md](freeswitch-runtime-integration.md)
  Runtime integration boundaries and expected roles for stock FreeSWITCH, the adapter service, and Lua helpers.

- [integration-test-plan.md](integration-test-plan.md)
  First end-to-end architecture proof plan from extension creation to event visibility.

- [first-local-demo.md](first-local-demo.md)
  Short local walkthrough for bringing up PostgreSQL and the API, registering a tenant, creating an extension, and calling the FreeSWITCH directory endpoint.

- [development/first-vertical-slice.md](development/first-vertical-slice.md)
  Fresh-checkout smoke test for the MVP path: tenant registration, encrypted SIP credential storage, and FreeSWITCH directory XML lookup.

- [development/live-freeswitch-registration.md](development/live-freeswitch-registration.md)
  Full local runtime proof: stock FreeSWITCH startup, containerized ESL agent, real SIP REGISTER, and persisted `registration_seen` event.

- [development/ivr-flow-foundation-proof.md](development/ivr-flow-foundation-proof.md)
  Command-driven proof of the first IVR desired-state slice: create flow, inspect versions, validate a draft, simulate it, and attempt publish safely.

- [development/ivr-runtime-resolver-proof.md](development/ivr-runtime-resolver-proof.md)
  Command-driven proof of the first backend IVR runtime resolver loop: create prompt + flow, publish it, start a runtime session, and advance constrained actions.

- [design/database-schema.md](design/database-schema.md)
  PostgreSQL schema direction covering relational mapping, versioning strategy, integrity rules, and the initial SQL DDL reference.

- [design/software-design.md](design/software-design.md)
  Software Design Description covering modules, services, domain model responsibilities, workflows, interfaces, and design decisions.

- [architecture/overview.md](architecture/overview.md)
  System architecture reference covering runtime topology, component boundaries, integration points, data flow, and deployment model.

- [adr/README.md](adr/README.md)
  Architecture Decision Record index and foundational decisions.

- [planning/README.md](planning/README.md)
  Release planning index with slice-by-slice dependency and sequencing guidance from the current baseline to product release.

## UI Documents

- [ui/UI_ARCHITECTURE.md](ui/UI_ARCHITECTURE.md)
  Frontend surface model, workspace split, routing structure, and data-loading architecture for the React app.

- [ui/UX_PRINCIPLES.md](ui/UX_PRINCIPLES.md)
  Product UX rules for safety, observability, reversibility, and enterprise clarity.

- [ui/DESIGN_SYSTEM.md](ui/DESIGN_SYSTEM.md)
  Design-token, Tailwind, component, typography, spacing, and flow-builder visual system guidance.

- [ui/ICONOGRAPHY.md](ui/ICONOGRAPHY.md)
  Icon-library selection, accessibility rules, and recommended icon map for platform and tenant surfaces.

## IVR Documents

- [ivr/IVR_ARCHITECTURE.md](ivr/IVR_ARCHITECTURE.md)
  Desired-state IVR architecture, lifecycle, and boundaries between API, runtime resolver, FreeSWITCH, n8n, and MCP.

- [ivr/FLOW_SCHEMA.md](ivr/FLOW_SCHEMA.md)
  Initial graph schema, node types, and graph integrity rules for IVR flow definitions.

- [ivr/VALIDATION_AND_SIMULATION.md](ivr/VALIDATION_AND_SIMULATION.md)
  Validation and simulation goals, safety role, and example request/response shapes.

- [ivr/RUNTIME_EXECUTION.md](ivr/RUNTIME_EXECUTION.md)
  Runtime session and execution design for stock FreeSWITCH with a thin Lua helper and backend resolver.

- [ivr/N8N_AND_MCP_PROGRAMMABILITY.md](ivr/N8N_AND_MCP_PROGRAMMABILITY.md)
  Safe programmability model for workflow automation and future MCP tools.

## Historical Documents

- [archive/initial-brainstorming.md](archive/initial-brainstorming.md)
  Early brainstorming notes retained for historical context.

- [archive/core-architecture-sketch.md](archive/core-architecture-sketch.md)
  Superseded architecture sketch retained only as a placeholder for the earlier draft.

## Documentation Rules

- `architecture/source-of-truth.md` remains the canonical direction-setting document.
- `requirements/srs.md`, `design/software-design.md`, and `architecture/overview.md` must stay aligned with the source-of-truth document.
- If implementation or design changes materially affect requirements or architecture, update the relevant document in the same pull request.
