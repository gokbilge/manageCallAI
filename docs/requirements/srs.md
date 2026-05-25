# manageCallAI Software Requirements Specification

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification defines the product and system requirements for `manageCallAI`.

The document is intended to guide implementation, validation, and future design decisions for the initial platform and MVP scope.

### 1.2 Scope

`manageCallAI` is an open-source telecom control plane built on top of FreeSWITCH.

It enables humans, workflows, and AI agents to manage PBX and IVR behavior through safe, high-level operations rather than low-level telecom internals.

The initial product scope focuses on a safe IVR and routing control plane with validation, simulation, publish, rollback, and auditability.

### 1.3 Intended Audience

- Product and architecture stakeholders
- Backend and frontend engineers
- DevOps and platform engineers
- QA and test automation engineers
- Integration developers
- Contributors implementing API, MCP, workflow, or FreeSWITCH integration

### 1.4 Definitions

- Control plane: The application layer responsible for intent capture, validation, orchestration, and publication of telecom state.
- Runtime: The active FreeSWITCH environment executing calls and consuming published state.
- Desired state: The canonical business-level telecom configuration stored in the application database.
- Published state: The validated and activated configuration currently exposed to runtime consumers.
- Draft: An editable, not-yet-published configuration version.
- Simulation: A pre-publish evaluation of expected routing or IVR behavior.
- MCP: Model Context Protocol interface used by AI agents to access safe application tools.

## 2. Product Overview

### 2.1 Product Vision

The product converts telecom administration into safe, composable business operations that can be used by:

- Human operators through a web UI
- Workflow systems through webhooks and APIs
- AI agents through constrained MCP tools

### 2.2 Business Problem

Traditional telecom systems expose low-level infrastructure concerns to users who actually need business-level control.

This creates steep onboarding cost, unsafe automation surfaces, weak change management, and poor AI compatibility.

### 2.3 Product Goals

- Provide a business-level telecom control plane above FreeSWITCH
- Support safe creation and lifecycle management of IVR and routing configuration
- Make configuration changes validated, auditable, and reversible
- Expose a stable abstraction equally usable by UI, API, workflows, and AI agents

### 2.4 Non-Goals

`manageCallAI` is not intended to be:

- A replacement for FreeSWITCH
- A raw SIP or RTP server
- A general-purpose ESL console
- A softphone
- A billing engine
- A low-level dialplan editor directly exposed to AI agents

## 3. System Context

### 3.1 External Systems

- FreeSWITCH runtime
- PostgreSQL database
- Web browsers used by administrators
- AI agents using MCP
- Workflow engines, initially n8n
- External telephony providers connected through FreeSWITCH trunks

### 3.2 User Classes

- Administrators
  Manage extensions, routes, prompts, IVR flows, validation, publish, rollback, and monitoring.

- Workflow Integrators
  Trigger draft creation, validation, and business event automation through approved APIs and webhooks.

- AI Agents
  Use restricted read, draft, validate, simulate, and publish-request operations through MCP.

## 4. Functional Requirements

### 4.1 Authentication and Authorization

- FR-1: The system shall authenticate all users and clients before allowing access to protected operations.
- FR-2: The system shall enforce role- or policy-based authorization for administrative operations.
- FR-3: The system shall scope all configuration and audit data to the appropriate tenant boundary when multi-tenancy is introduced.

### 4.2 Extension Management

- FR-4: The system shall allow creation, update, listing, and deactivation of extensions.
- FR-5: The system shall validate uniqueness and consistency of extension identifiers within the active tenant scope.

### 4.3 Trunk and Number Management

- FR-6: The system shall allow management of SIP trunk definitions required for MVP call routing.
- FR-7: The system shall allow management of DIDs or phone numbers and their assignment targets.

### 4.4 Routing Management

- FR-8: The system shall allow inbound routes to be defined and associated with extensions, IVR flows, or other supported destinations.
- FR-9: The system shall allow outbound route definitions within approved policy boundaries.
- FR-10: The system shall validate routes before publication.

### 4.5 Prompt and Media Management

- FR-11: The system shall support upload and management of prompt assets used by IVR flows.
- FR-12: The system shall validate prompt metadata and references before publish.

### 4.6 IVR Flow Management

- FR-13: The system shall allow users to create and edit IVR flows in draft state.
- FR-14: The system shall maintain version history for publishable flow objects.
- FR-15: The system shall support visual representation of IVR flow structure in the web UI.
- FR-16: The system shall support publish and rollback for IVR flows.

### 4.7 Validation and Simulation

- FR-17: The system shall validate draft configurations against structural rules.
- FR-18: The system shall validate draft configurations against business and telecom safety rules.
- FR-19: The system shall provide simulation of expected call routing and IVR behavior before publish.
- FR-20: Validation and simulation results shall be stored and retrievable for review.

### 4.8 Publish and Rollback

- FR-21: The system shall publish only validated configurations.
- FR-22: The system shall maintain an active version pointer for publishable objects.
- FR-23: The system shall preserve prior published versions for rollback.
- FR-24: The system shall record every publish and rollback operation in the audit trail.

### 4.9 FreeSWITCH Integration

- FR-25: The system shall generate or serve FreeSWITCH-compatible runtime artifacts from published state.
- FR-26: The system shall support dynamic dialplan and directory generation through supported adapter mechanisms such as `mod_xml_curl`.
- FR-27: The system shall ingest selected FreeSWITCH events and call detail records into the control plane.

### 4.10 API

- FR-28: The system shall expose REST API endpoints for first-party and approved third-party clients.
- FR-29: The API shall operate on business objects rather than low-level FreeSWITCH primitives.
- FR-30: The API shall expose draft, validation, simulation, publish, and audit-related operations.

### 4.11 MCP

- FR-31: The system shall expose a constrained MCP server for AI agent access.
- FR-32: MCP tools shall support read-only queries, draft mutation, validation, simulation, and publish request operations.
- FR-33: MCP tools shall reject raw XML editing and unrestricted command execution.

### 4.12 Workflow Integration

- FR-34: The system shall emit business-level telecom events for workflow consumption.
- FR-35: The system shall support inbound automation through approved API or webhook entry points.

### 4.13 Observability and Audit

- FR-36: The system shall store audit records for configuration mutations and operationally significant actions.
- FR-37: The system shall store call timeline and event data for inspection.
- FR-38: The system shall provide visibility into validation, simulation, publish, and rollback outcomes.

## 5. Non-Functional Requirements

### 5.1 Safety

- NFR-1: The system shall prevent direct low-level telecom operations from being exposed to AI agents.
- NFR-2: Risky state changes shall be validated before activation.
- NFR-3: The system shall support rollback of publishable objects.

### 5.2 Reliability

- NFR-4: Published state served to runtime integrations shall be internally consistent.
- NFR-5: The platform shall minimize runtime drift between desired state and generated runtime artifacts.

### 5.3 Security

- NFR-6: All protected interfaces shall require authentication.
- NFR-7: Administrative and automation operations shall be authorized according to policy.
- NFR-8: Sensitive operational events shall be logged in an audit trail.

### 5.4 Performance

- NFR-9: Common read operations for extensions, routes, and flow summaries should support responsive UI and automation use.
- NFR-10: Validation and simulation should complete within practical interactive limits for MVP-scale configurations.

### 5.5 Maintainability

- NFR-11: The system shall maintain a stable domain vocabulary across UI, API, MCP, and workflow interfaces.
- NFR-12: The software shall be structured so integration adapters remain separable from core business logic.

### 5.6 Extensibility

- NFR-13: The design should allow future multi-tenant isolation, richer policy engines, and broader workflow integration without replacing the core domain model.

## 6. Constraints

- C-1: FreeSWITCH remains the telecom runtime and must not be replaced by the control plane.
- C-2: Desired state must live in PostgreSQL or an equivalent canonical application data store.
- C-3: Low-level switch internals must not become the dominant public interface model.
- C-4: MCP must remain narrower and safer than the REST API.

## 7. Assumptions and Dependencies

- A working FreeSWITCH deployment is available for runtime integration and testing.
- PostgreSQL is available as the canonical persistence layer.
- Browser-based administrators will use a React + TypeScript UI.
- The main control plane API will use Node.js + TypeScript.
- The MCP server will use TypeScript.
- n8n and webhooks will be the initial workflow integration model.
- A Go runtime agent will handle FreeSWITCH-side coordination outside the switch boundary.
- Lua will be used for in-switch call helper logic where needed.

## 8. MVP Acceptance Criteria

- AC-1: An administrator can define extensions, a trunk, numbers, and basic routes.
- AC-2: An administrator can create and edit an IVR flow draft.
- AC-3: A draft can be validated and simulated before publication.
- AC-4: A validated draft can be published to become active runtime state.
- AC-5: A prior published version can be rolled back.
- AC-6: FreeSWITCH can consume generated dialplan or directory state for MVP routing behavior.
- AC-7: An AI agent or n8n workflow can safely create, validate, simulate, and request publication of an IVR without direct FreeSWITCH knowledge.

## 9. Traceability Notes

- `../architecture/source-of-truth.md` defines product intent and architectural boundaries.
- `../architecture/overview.md` defines runtime structure and integration topology.
- `../design/software-design.md` defines the internal software decomposition and major design choices.
