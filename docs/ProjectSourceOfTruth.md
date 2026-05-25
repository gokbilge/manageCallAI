# manageCallAI Project Source of Truth

This document is the canonical product, design, and architecture reference for manageCallAI.

If another document conflicts with this one, this document wins until an explicit architecture decision updates it.

## 1. Purpose

manageCallAI is an open-source telecom control plane built on top of FreeSWITCH.

Its job is to let humans, workflows, and AI agents manage PBX and IVR behavior through safe, high-level abstractions instead of low-level telecom internals.

manageCallAI does not replace FreeSWITCH. It sits above FreeSWITCH as the management, orchestration, API, workflow, and safety layer.

## 2. Product Thesis

Traditional PBX systems expose too much infrastructure detail to the operator.

AI agents and automation systems should not need to understand:

- SIP trunks
- RTP ports
- FreeSWITCH XML dialplans
- ESL commands
- Codec negotiation
- NAT behavior
- DTMF edge cases
- Internal routing mechanics

manageCallAI converts telecom administration into safe business actions such as:

- Create an extension
- Build an IVR flow
- Assign a DID to a route or flow
- Validate a proposed routing change
- Simulate a call path before publish
- Publish or roll back a call-flow version
- Trigger downstream workflow automation
- Review call events and outcomes

## 3. Problem Statement

FreeSWITCH is powerful, but most teams that want programmable voice systems still have to work directly with telecom-specific primitives.

That creates four problems:

1. The learning curve is too steep for application developers and operations teams.
2. Safe automation is difficult because low-level command surfaces are too broad.
3. UI and workflow tooling usually end up bolted onto fragile custom scripts.
4. There is no clean control-plane abstraction that can be safely exposed to AI agents.

manageCallAI exists to solve those four problems.

## 4. Non-Goals

manageCallAI is not:

- A SIP server
- A media server
- A FreeSWITCH replacement
- A softphone
- A billing platform
- A general-purpose raw ESL console
- A low-level dialplan editor exposed directly to AI agents

## 5. Primary Users

The system is designed for three operator categories:

- Human administrators using a web UI
- Automation workflows, initially through n8n and webhooks
- AI agents using MCP tools

These users all operate against the same logical control plane and should produce auditable, validated state changes.

## 6. Core Product Principles

### 6.1 Safety First

No user class, especially AI agents, should be given unrestricted access to FreeSWITCH internals.

### 6.2 Desired State Over Imperative Mutation

The platform should model the intended telecom configuration as desired state stored in the application database, then render that state into FreeSWITCH-facing runtime artifacts.

### 6.3 Validate Before Publish

Configuration should be validated structurally and behaviorally before becoming active.

### 6.4 Simulation Before Production

Users should be able to preview route and IVR behavior before publish.

### 6.5 Rollback as a First-Class Operation

Every publishable object should support version history and safe rollback.

### 6.6 One High-Level Domain Model

UI, REST API, MCP tools, and workflow integrations should all operate on the same domain vocabulary.

### 6.7 Telecom Engine Separation

FreeSWITCH remains the runtime media and signaling engine. manageCallAI owns orchestration, policy, visibility, and safe abstraction.

## 7. Canonical System Model

At a high level:

```text
Humans / AI Agents / Workflows
              |
              v
      manageCallAI Control Plane
   UI + REST API + MCP + Webhooks
              |
              v
   PostgreSQL Desired State + Audit
              |
              v
    FreeSWITCH Adapter / Renderer
   mod_xml_curl + ESL + Lua helpers
              |
              v
         FreeSWITCH Runtime
          SIP / RTP / Calls
```

## 8. Major Components

### 8.1 React Admin UI

The web UI is the operator-facing management console.

Responsibilities:

- Extension management
- DID and route management
- Prompt upload and prompt library browsing
- Visual IVR builder
- Validation and simulation review
- Publish and rollback actions
- Event and call timeline inspection

### 8.2 Control Plane API

The control plane API is the central application layer and system boundary.

Responsibilities:

- Authentication and authorization
- Domain validation
- Persistence of desired state
- Versioning of publishable objects
- Change approval workflows
- Simulation orchestration
- Audit logging
- Integration endpoints for UI, MCP, and n8n

The API should be treated as the authoritative backend contract for first-party and third-party clients.

### 8.3 MCP Server

The MCP server exposes safe tools for AI agents.

Responsibilities:

- Read-only visibility into telecom objects
- Draft creation and draft mutation
- Validation requests
- Simulation requests
- Approval-gated publish requests

Constraints:

- No raw ESL command execution
- No arbitrary XML editing
- No unrestricted shell-like telecom operations

### 8.4 Workflow Integration Layer

The workflow layer initially targets n8n compatibility through webhooks and API endpoints.

Responsibilities:

- Emit business-level telecom events
- Allow approved automation to create drafts
- Trigger downstream CRM/helpdesk/ops automations

### 8.5 PostgreSQL

PostgreSQL stores the canonical desired state and operational metadata.

Responsibilities:

- Configuration state
- Version history
- Audit records
- Simulation records
- CDR ingestion results
- Call event timeline data

### 8.6 FreeSWITCH Adapter Layer

This layer translates desired state into runtime behavior that FreeSWITCH can consume.

Likely mechanisms:

- `mod_xml_curl` for dynamic dialplan and directory generation
- ESL consumers for event ingestion and runtime actions
- Lua or other helper scripts when needed inside the FreeSWITCH boundary

Responsibilities:

- Render active state into FreeSWITCH-compatible responses
- Enforce stable translation from business objects to telecom artifacts
- Ingest events back into the control plane

### 8.7 FreeSWITCH Runtime

FreeSWITCH remains responsible for:

- SIP signaling
- RTP/media handling
- Real-time call execution
- Runtime telecom primitives

## 9. Domain Model

The platform should converge on a stable domain vocabulary.

Initial core entities:

- Tenant
- User
- Extension
- SIP trunk
- DID / phone number
- Inbound route
- Outbound route
- Prompt asset
- IVR flow
- Flow version
- Publish record
- Validation result
- Simulation result
- Call detail record
- Call event
- Audit event

### 9.1 Publishable Objects

A publishable object is any configuration object whose active state changes production call behavior.

Initially these include:

- IVR flows
- Routing definitions
- Prompt references where prompts affect live call paths

Each publishable object should support:

- Draft state
- Validation state
- Version history
- Active version pointer
- Rollback target selection

## 10. State Model

The platform should distinguish clearly between:

- Draft state
- Validated state
- Simulated state
- Published state
- Rolled-back state

Suggested publish lifecycle:

1. User creates or edits a draft.
2. System validates schema and business rules.
3. System simulates expected routing and flow behavior.
4. Human or policy approves the change if required.
5. System publishes a new active version.
6. Runtime traffic begins using the new version.
7. Prior version remains available for rollback.

## 11. MVP Definition

The first meaningful release is not a generic PBX. It is a safe IVR and routing control plane.

MVP scope:

- Single tenant
- Extensions
- One SIP trunk
- Inbound route
- Basic outbound route
- Prompt upload
- Visual IVR flow editing
- Flow validation
- Flow simulation
- Publish and rollback
- Dynamic FreeSWITCH dialplan generation
- CDR ingestion
- Call event timeline
- Read-only MCP tools
- Draft and simulate MCP tools
- n8n webhook examples

MVP success condition:

An AI agent or n8n workflow can safely create, validate, simulate, and publish a working IVR on FreeSWITCH without needing to understand FreeSWITCH internals.

## 12. Safety and Security Model

Telecom systems are sensitive. The safety model is part of the product, not an add-on.

Required principles:

- No raw FreeSWITCH command access for AI agents
- No direct XML editing through MCP
- No production publish without validation
- Optional approval gates for risky changes
- Full audit trail for every configuration mutation
- Tenant-scoped access control
- Destination allowlists for outbound safety
- Route-impact analysis before publish
- Rollback-first publishing model

## 13. API Design Rules

The API should expose business objects and business actions, not FreeSWITCH internals.

Preferred API shape:

- `extensions`
- `trunks`
- `numbers`
- `routes`
- `flows`
- `prompts`
- `simulations`
- `publishes`
- `events`

Avoid API designs centered on:

- Raw dialplan fragments
- Arbitrary XML payloads
- ESL command passthrough
- Runtime-specific switch internals as first-class public objects

## 14. MCP Design Rules

MCP tooling must stay narrower than the REST API.

Initial MCP categories:

- Read current extensions, routes, and flow summaries
- Create or edit draft flows
- Validate draft flows
- Simulate proposed call behavior
- Request publish of already validated drafts

Rules:

- Tools should be intent-based
- Tool inputs must be schema-validated
- Risky actions should require explicit confirmation or approval policy
- Output should be concise, auditable, and machine-usable

## 15. Workflow Design Rules

n8n and webhook integrations should use business events rather than low-level switch events by default.

Examples:

- Missed call created
- Route publish completed
- Validation failed
- Prompt uploaded
- IVR version rolled back

Raw switch events can still be ingested internally, but workflow users should not be forced to understand them.

## 16. Data Ownership and Source of Truth

The source of truth for telecom intent lives in the control plane database.

FreeSWITCH is a runtime consumer of active published state, not the primary store for business intent.

That means:

- Desired state is written to PostgreSQL first
- Publish activates a version for runtime consumption
- Runtime artifacts are derived outputs
- Runtime drift should be minimized by regeneration, not hand-editing

## 17. Initial Repository Documentation Model

To keep GitHub documentation clean, the repository should follow this rule:

- `README.MD` explains the project and links to canonical docs
- `docs/ProjectSourceOfTruth.md` is the main architecture and design reference
- Future ADRs should capture explicit deviations or decisions not already frozen here

Suggested future supporting docs:

- `docs/adr/`
- `docs/adr/README.MD`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `LICENSE`
- `docs/README.MD`
- `docs/SRS.md`
- `docs/DomainModel.md`
- `docs/SDD.md`
- `docs/Architecture.md`
- `docs/api/`
- `docs/examples/`

## 18. Roadmap

### Milestone 1: FreeSWITCH Control Plane

- Dynamic extension lookup
- Dynamic inbound routing
- Basic outbound routing
- CDR ingestion
- Call event timeline

### Milestone 2: Visual IVR

- Flow schema
- Visual builder
- Prompt manager
- Publish and rollback
- Flow simulator

### Milestone 3: MCP

- MCP server
- Read-only tools
- Draft creation tools
- Validation tools
- Simulation tools
- Approval-gated publishing

### Milestone 4: n8n

- Webhook events
- Example workflows
- OpenAPI spec
- Custom n8n nodes

### Milestone 5: Production Hardening

- Multi-tenant isolation
- RBAC
- Audit logs
- Policy engine
- HA-ready FreeSWITCH support
- Monitoring and alerting

## 19. Open Questions

These are not resolved by the current design and should be tracked explicitly as decisions:

- Whether the provisional Apache-2.0 license should remain the long-term license
- Exact multi-tenant model after MVP
- Whether outbound calling policy is route-based, tenant-policy-based, or both
- Prompt storage strategy
- Simulation engine depth and fidelity
- Approval workflow model for human-in-the-loop publishing
- Event ingestion and retention policy

## 20. Change Control

This document should change when the architecture changes, not after.

If a proposed implementation conflicts with this document, one of two things must happen:

1. The implementation changes to match the document.
2. The document is updated first with the new intended design.

For major changes, add an ADR and update this file in the same pull request.
