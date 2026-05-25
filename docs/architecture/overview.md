# manageCallAI Architecture Documentation

## 1. Purpose

This document describes the target system architecture for `manageCallAI`.

It defines the runtime topology, major components, data boundaries, integration mechanisms, and deployment view for the platform.

## 2. Architectural Drivers

- Safety-first telecom abstraction
- Separation of control plane from telecom runtime
- Support for humans, workflows, and AI agents through one domain model
- Versioned, auditable, and reversible configuration lifecycle
- Integration-friendly architecture for FreeSWITCH, MCP, and n8n

## 3. High-Level Architecture

```text
manageCallAI API
      |
      v
FreeSWITCH Adapter Service
      |
      v
mod_xml_curl + ESL + Lua helpers
      |
      v
Stock FreeSWITCH
```

## 4. Architectural Style

The system follows a layered control-plane architecture with explicit integration adapters.

Core business logic owns intent, lifecycle, validation, and publication.

External systems such as FreeSWITCH, browsers, AI agents, and workflow engines interact with the control plane through constrained interfaces.

manageCallAI does not fork or replace FreeSWITCH. It runs on top of stock FreeSWITCH through supported extension interfaces and keeps project-specific logic outside the switch runtime.

## 4.1 Responsibility Split

- Business logic: manageCallAI backend
- AI / MCP / n8n logic: manageCallAI backend
- Call execution: FreeSWITCH
- Optional call-session helper: Lua
- Runtime event/control agent: Go or Node

## 5. Component View

### 5.1 Admin UI

- React + TypeScript operator console
- Consumes backend APIs
- Presents domain-level telecom objects and lifecycle operations

### 5.2 API Layer

- Node.js + TypeScript service
- REST endpoints for application and integration clients
- Authentication and authorization enforcement
- Domain orchestration entry point

### 5.3 MCP Layer

- TypeScript MCP server
- Dedicated AI-facing surface
- Narrower than the REST API
- Safe read, draft, validate, simulate, and publish-request operations

### 5.4 Workflow Layer

- n8n and webhook integration surface
- Webhook and integration endpoint surface
- Event emission for downstream automation
- Automation intake for approved draft and validation actions

### 5.5 Domain Core

- Domain entities and service rules
- Validation engine
- Simulation engine
- Publish and rollback orchestration

### 5.6 Persistence Layer

- PostgreSQL as source of truth
- Stores desired state, versions, audit records, simulation outputs, and runtime event summaries

### 5.7 FreeSWITCH Adapter Layer

- Go adapter service coordinating FreeSWITCH integration
- Renders active state into FreeSWITCH-consumable formats
- Handles event and CDR ingestion
- Delegates in-switch call helper logic to Lua where needed
- Shields the domain core from switch-specific runtime details
- Keeps project-specific logic outside stock FreeSWITCH

For MVP, Lua should be limited to:

- `play_collect`
- `play_prompt`
- `transfer`
- `hangup`
- `set_variable`
- call API for next step

Lua should not contain business logic.

### 5.8 FreeSWITCH Runtime

- Executes SIP and media handling
- Executes Lua call helper scripts inside the FreeSWITCH boundary
- Consumes generated configuration state
- Produces events and call execution outcomes
- Remains otherwise stock FreeSWITCH

Example Lua action payload:

```json
{
  "action": "play_collect",
  "prompt": "main_menu_tr.wav",
  "maxDigits": 1,
  "timeoutMs": 5000
}
```

Lua executes the requested action and reports the result back to the adapter or API layer.

## 6. Data Flow View

### 6.1 Configuration Flow

1. UI, API client, MCP tool, or webhook submits a business-level change.
2. The control plane validates and stores desired state in PostgreSQL.
3. Validation and simulation may execute before publication.
4. Publish activates a version.
5. The adapter layer exposes the active version to stock FreeSWITCH through `mod_xml_curl`, `ESL` / `mod_event_socket`, and minimal Lua helpers.

### 6.2 Runtime Observation Flow

1. FreeSWITCH emits events and CDRs.
2. The adapter layer ingests and normalizes them.
3. The control plane stores operational records.
4. UI, API, and workflows consume summarized or business-level views.

## 7. Deployment View

### 7.1 Minimum MVP Deployment

- Web UI
- Node.js / TypeScript control plane backend
- TypeScript MCP server
- PostgreSQL
- n8n / webhook integration surface
- Go FreeSWITCH runtime agent
- FreeSWITCH

These may run as separate services or a small number of deployable units depending on implementation maturity.

### 7.2 Logical Network Boundaries

- Public or internal operator access to UI and API
- Restricted access to administrative endpoints
- Controlled connectivity between control plane and FreeSWITCH
- Database reachable only by trusted application services

## 8. Trust Boundaries

- Boundary A: Browser or external client to application API
- Boundary B: AI agent to MCP server
- Boundary C: Workflow engine to webhook or API integration entry points
- Boundary D: Control plane to database
- Boundary E: Control plane to FreeSWITCH and runtime event sources

Each boundary requires authentication, authorization, input validation, and operational logging where applicable.

## 9. Security Architecture

- No raw FreeSWITCH command access for AI agents
- No arbitrary XML editing as a public interface
- Publish lifecycle guarded by validation and optional approvals
- Tenant-scoped or policy-scoped data access
- Full audit trail for state mutations and publish operations

## 10. Availability and Resilience Considerations

- Active state should be derivable from persisted published versions
- Adapter failures should not corrupt desired state
- Publish operations should fail atomically from the domain perspective
- Event ingestion should tolerate delayed or retried processing

## 11. Scalability Considerations

- Read-heavy UI and API access should scale independently from runtime call execution
- Workflow and MCP consumers should not bypass control-plane safety logic
- Event ingestion paths should scale separately from configuration mutation paths

## 12. Observability Architecture

- Audit logs for business mutations
- Validation and simulation history
- Publish and rollback history
- Call event and CDR ingestion records
- Operational logs and metrics for adapter and API components

## 13. Technology Direction

- Frontend: React + TypeScript
- Main API / Control Plane: Node.js + TypeScript
- Database: PostgreSQL
- Workflow: n8n + Webhooks
- AI: MCP server in TypeScript
- FreeSWITCH Runtime Agent: Go
- FreeSWITCH Call Helper: Lua
- Telecom runtime: FreeSWITCH

## 14. Architecture Decisions To Track

- Multi-tenant isolation model
- Runtime artifact generation strategy
- Event ingestion topology
- Approval workflow implementation
- Prompt storage and media-serving approach

## 15. Relationship to Other Documents

- `source-of-truth.md` defines canonical direction and boundaries
- `../requirements/srs.md` defines what the system must do
- `../design/software-design.md` defines how the software is logically decomposed
