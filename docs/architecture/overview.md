# manageCallAI Architecture Documentation

## 1. Purpose

This document describes the current target system architecture for `manageCallAI`.

It defines the runtime topology, major components, ownership boundaries, integration mechanisms, and deployment view.

## 2. Architectural drivers

- safety-first telecom abstraction
- separation of control plane from telecom runtime
- one domain model for humans, workflows, and AI agents
- versioned, auditable, and reversible configuration lifecycle
- FreeSWITCH integration through supported stock interfaces
- provider-neutral contracts for optional external adapters

## 3. High-level architecture

```text
React Web UI
   -> REST API
      -> PostgreSQL desired state
      -> validation / simulation / publish / rollback / audit
      -> runtime artifact generation
      -> FreeSWITCH mod_xml_curl directory/dialplan
      -> Lua thin executor
      -> Go ESL agent
      -> call events / observability

MCP / n8n
   -> safe API abstractions only
```

FreeSWITCH remains the media and signaling runtime. The API is the control plane and source of lifecycle authority. MCP and n8n stay narrower than REST and must not expose raw ESL, raw XML, shell, SQL, or direct runtime control.

Release posture is not inferred from this document. Release stage and promotion status must come from release evidence tied to a candidate commit or workflow artifact.

## 4. Architectural style

The system follows a layered control-plane architecture with explicit integration adapters.

Core business logic owns intent, lifecycle, validation, and publication. External systems such as browsers, FreeSWITCH, AI agents, and workflow engines interact with the control plane through constrained interfaces.

## 5. Component view

### 5.1 Admin UI

- React + TypeScript operator console in `apps/web`
- consumes backend APIs via typed client code
- presents domain-level telecom objects and lifecycle operations
- includes platform and tenant surfaces
- includes setup/bootstrap surface through `/setup` on first boot

### 5.2 API layer

- Node.js + TypeScript service in `apps/api`
- REST endpoints for application and integration clients
- authentication and authorization enforcement
- domain orchestration entry point
- runtime callback endpoints for FreeSWITCH, Lua, and the Go agent
- setup/bootstrap gate using `system_config`
- shared API-facing schemas from `packages/contracts`

### 5.3 Persistence layer

- PostgreSQL as source of truth
- stores desired state, version pointers, audit history, runtime summaries, and setup sentinel state

### 5.4 MCP layer

- TypeScript MCP server
- dedicated AI-facing surface
- narrower than REST
- safe read, draft, validate, simulate, and publish-request operations

### 5.5 Workflow layer

- n8n and webhook integration surface
- event emission for downstream automation
- approved automation entry points through bounded API actions

### 5.6 AI assistance layer

- API-owned operator assistance workflows
- explanation, risk analysis, summarization, and natural-language reporting
- grounded in normalized API data rather than direct runtime internals
- bounded by the same tenant, capability, audit, and lifecycle rules as the rest
  of the control plane

Planned `v0.6.x` AI assistance is explicitly assistive. It may generate
explanations, summaries, and draft-safe recommendations, but it must not bypass
validation, simulation, approval, publish, rollback, or runtime auth controls.

### 5.7 FreeSWITCH adapter layer

- Go adapter service coordinating FreeSWITCH integration
- renders active state into FreeSWITCH-consumable formats
- handles event and CDR ingestion
- posts normalized runtime status snapshots back to the API
- keeps project-specific logic outside stock FreeSWITCH

### 5.8 Lua runtime helper

- lives inside FreeSWITCH
- executes constrained per-call actions only
- must not contain business lifecycle logic

### 5.9 FreeSWITCH runtime

- executes SIP and media handling
- executes dialplan and Lua helper scripts
- consumes generated configuration state
- produces runtime events and operational outcomes

## 6. Data flow view

### 6.1 Configuration flow

1. UI, API client, MCP tool, or webhook submits a business-level change.
2. The API validates and stores desired state in PostgreSQL.
3. Validation and simulation may execute before publication.
4. Publish activates a version or desired-state record.
5. Runtime artifacts are exposed to FreeSWITCH through `mod_xml_curl`, bounded callbacks, and the Go agent.

### 6.2 Runtime observation flow

1. FreeSWITCH emits events and runtime facts.
2. The Go agent ingests and normalizes them.
3. The API stores operational records and status snapshots.
4. UI, API, and workflows consume summarized business-level views.

### 6.3 AI assistance flow

1. Operator requests a bounded explanation, summary, risk view, or natural-language query.
2. The API resolves the request against normalized tenant-scoped records.
3. Optional AI assistance generates an explanation or summary from that bounded context.
4. The API stores audit attribution and returns a business-level result.
5. Any recommended mutation remains a draft or advisory result until the normal lifecycle approves it.

### 6.4 Setup/bootstrap flow

1. API startup checks `system_config` for `setup_complete`.
2. If absent and required `SETUP_*` env vars are present, headless bootstrap runs.
3. If absent and headless bootstrap is not configured, `/setup` routes are registered.
4. Successful completion writes `setup_complete` and disables the setup surface.

## 7. Deployment view

### 7.1 Core services

- `apps/api`
- `apps/web`
- `apps/worker`
- `apps/mcp`
- `apps/freeswitch-agent`
- PostgreSQL
- FreeSWITCH

### 7.2 Current packaging in the repository

The repository currently includes:

- `docker-compose.prod.yml`
- `.env.production.example`
- `install.sh`
- `charts/managecallai/`

These artifacts package deployment paths. They are not by themselves evidence that a release has passed runtime or production gates.
