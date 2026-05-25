# Documentation Index

This directory contains the primary project documentation for `manageCallAI`.

## Core Documents

- [ProjectSourceOfTruth.md](ProjectSourceOfTruth.md)
  Canonical product thesis, scope boundaries, and high-level design intent.

- [SRS.md](SRS.md)
  Software Requirements Specification covering functional requirements, non-functional requirements, constraints, assumptions, and acceptance criteria.

- [DomainModel.md](DomainModel.md)
  Detailed business domain model covering entities, relationships, lifecycle states, and invariants.

- [API.md](API.md)
  Initial REST API contract covering resources, lifecycle operations, payload shapes, and error handling.

- [SDD.md](SDD.md)
  Software Design Description covering modules, services, domain model responsibilities, workflows, interfaces, and design decisions.

- [Architecture.md](Architecture.md)
  System architecture reference covering runtime topology, component boundaries, integration points, data flow, and deployment model.

- [adr/README.MD](adr/README.MD)
  Architecture Decision Record index and foundational decisions.

## Historical Documents

- [Initial.MD](Initial.MD)
  Early brainstorming notes retained for historical context.

- [CoreArchitecture.MD](CoreArchitecture.MD)
  Superseded architecture sketch retained only as a placeholder for the earlier draft.

## Documentation Rules

- `ProjectSourceOfTruth.md` remains the canonical direction-setting document.
- `SRS.md`, `SDD.md`, and `Architecture.md` must stay aligned with the source-of-truth document.
- If implementation or design changes materially affect requirements or architecture, update the relevant document in the same pull request.
