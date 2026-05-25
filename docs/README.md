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

- [design/database-schema.md](design/database-schema.md)
  PostgreSQL schema direction covering relational mapping, versioning strategy, integrity rules, and the initial SQL DDL reference.

- [design/software-design.md](design/software-design.md)
  Software Design Description covering modules, services, domain model responsibilities, workflows, interfaces, and design decisions.

- [architecture/overview.md](architecture/overview.md)
  System architecture reference covering runtime topology, component boundaries, integration points, data flow, and deployment model.

- [adr/README.md](adr/README.md)
  Architecture Decision Record index and foundational decisions.

## Historical Documents

- [archive/initial-brainstorming.md](archive/initial-brainstorming.md)
  Early brainstorming notes retained for historical context.

- [archive/core-architecture-sketch.md](archive/core-architecture-sketch.md)
  Superseded architecture sketch retained only as a placeholder for the earlier draft.

## Documentation Rules

- `architecture/source-of-truth.md` remains the canonical direction-setting document.
- `requirements/srs.md`, `design/software-design.md`, and `architecture/overview.md` must stay aligned with the source-of-truth document.
- If implementation or design changes materially affect requirements or architecture, update the relevant document in the same pull request.
