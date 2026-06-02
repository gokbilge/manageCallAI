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
- Provider-neutral contracts for optional AI, media, messaging, and meeting adapters

## 3. High-Level Architecture

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

FreeSWITCH remains the media/signaling runtime. The API is the control plane and
source of lifecycle authority. MCP and n8n must stay narrower than REST and must
not expose raw ESL, raw XML, shell, SQL, or direct runtime control.

## 4. Architectural Style

The system follows a layered control-plane architecture with explicit integration adapters.

Core business logic owns intent, lifecycle, validation, and publication.

External systems such as FreeSWITCH, browsers, AI agents, and workflow engines interact with the control plane through constrained interfaces.

manageCallAI does not fork or replace FreeSWITCH. It runs on top of stock FreeSWITCH through supported extension interfaces and keeps project-specific logic outside the switch runtime.

The repository itself is operated through GitHub as a protected collaboration
boundary. `main` is not the normal write path. Changes flow through focused
branches, draft pull requests, required CI/security checks, CODEOWNERS review,
and GitHub merge. Audit findings that remain unresolved are tracked as GitHub
Issues and linked back to the audit record.

## 4.1 Responsibility Split

- Business logic: manageCallAI backend
- AI / MCP / n8n logic: manageCallAI backend
- Call execution: FreeSWITCH
- Optional call-session helper: Lua
- Runtime event/control agent: Go or Node

## 5. Component View

### 5.1 Admin UI

- React 18 + TypeScript 5 operator console built with Vite
- Two workspace surfaces sharing one React app: **Platform** (indigo, `platform_admin`) and **Tenant** (cyan, role-based)
- Consumes backend APIs via a typed `apiRequest` client (`src/lib/api/client.ts`)
- Presents domain-level telecom objects and lifecycle operations
- Provides a live operations cockpit for active sessions, queue pressure, runtime health, and recent failures
- Design system: Tailwind v4 `@theme` tokens, Inter + JetBrains Mono, Lucide React icons (exclusive), no gradients or illustrations
- Brand assets in `apps/web/public/` (SVG marks for light/dark, PNG favicon)
- See `docs/design/ux-design.md` for design tokens, color system, and component patterns
- See `docs/ui/UI_ARCHITECTURE.md` for layout, routing, and feature surface details

### 5.2 API Layer

- Node.js + TypeScript service
- REST endpoints for application and integration clients
- Authentication and authorization enforcement
- Domain orchestration entry point
- Shared API-facing schemas from `packages/contracts`

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

### 5.5 Provider Integration Layer

- Optional adapter workers or plugins for AI, media, messaging, meeting, and channel systems
- Runs as independent service processes outside `apps/api`
- Claims asynchronous work from internal API endpoints and posts bounded results back
- Supports recording analysis, prompt generation, IVR AI turns, outbound messages,
  inbound message ingestion, and channel voice or meeting sessions
- Uses capability flags because providers do not expose identical message and voice features
- Keeps provider credentials and raw provider payloads outside public domain responses
- Treats bundled WhatsApp, Telegram, and Google Meet implementations as placeholders
  until a deployer installs external adapters

### 5.6 Domain Core

- Domain entities and service rules
- Validation engine
- Simulation engine
- Publish and rollback orchestration

### 5.6.1 Contract Generation

- `packages/contracts` owns API-facing Zod schemas and OpenAPI component registration.
- `scripts/generate-openapi.mjs` emits `docs/api/openapi.yaml` and verifies all
  path `$ref`s resolve to generated components.
- `packages/sdk` derives TypeScript client types from the generated OpenAPI document.
- CI treats generated OpenAPI drift as a failure.

### 5.7 Persistence Layer

- PostgreSQL as source of truth
- Stores desired state, versions, audit records, simulation outputs, and runtime event summaries
- Stores provider-neutral request, result, channel, and recording metadata

### 5.8 FreeSWITCH Adapter Layer

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

### 5.9 FreeSWITCH Runtime

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

## 6.1 First Vertical Slice

The first implementation slice should prove the architecture end to end:

1. Create extension in API
2. Store extension in PostgreSQL
3. Serve extension directory via `mod_xml_curl`
4. Register SIP phone to FreeSWITCH
5. Ingest registration or call event
6. Show call event through API

This is the minimum slice that demonstrates control-plane state, runtime consumption, event ingestion, and API visibility in one loop.

### 6.2 Configuration Flow

1. UI, API client, MCP tool, or webhook submits a business-level change.
2. The control plane validates and stores desired state in PostgreSQL.
3. Validation and simulation may execute before publication.
4. Publish activates a version.
5. The adapter layer exposes the active version to stock FreeSWITCH through `mod_xml_curl`, `ESL` / `mod_event_socket`, and minimal Lua helpers.

### 6.3 Runtime Observation Flow

1. FreeSWITCH emits events and CDRs.
2. The adapter layer ingests and normalizes them.
3. The control plane stores operational records.
4. UI, API, and workflows consume summarized or business-level views.
5. Live UI surfaces receive authorized WebSocket or Server-Sent Events updates
   derived from normalized operational state.

### 6.4 Provider Work Request Flow

1. UI, workflow, MCP, or runtime logic creates a provider-neutral work request.
2. The control plane stores the request with tenant scope and status `queued`.
3. A trusted adapter worker or plugin claims the request through an internal endpoint.
4. The worker calls its configured provider outside the domain core.
5. The worker posts a bounded result or failure back to the control plane.
6. UI, API, MCP, and workflows read the business result, not raw provider state.

This flow applies to recording analysis, prompt generation, and IVR AI turns.

### 6.5 Channel Adapter Flow

1. A tenant configures a channel account with explicit capabilities.
2. Outbound messages are submitted as business-level channel messages.
3. The API stores outbound requests as queued provider-neutral work.
4. An independent adapter service claims queued work through an internal endpoint.
5. The adapter delivers through WhatsApp, Telegram, Google Meet, or a custom provider
   outside the API process and reports sent or failed results back.
6. Inbound provider events are ingested through internal endpoints and normalized.
7. Voice-message, native-call, meeting, and SIP-bridge sessions are represented by
   capability-specific channel voice session records.

### 6.6 Audit Finding Flow

1. An agent, maintainer, or reviewer runs an audit using `docs/audit/audit.md`.
2. The audit record is committed under `docs/audit/audits/` with stable finding IDs.
3. Findings resolved in the same session are marked `done` in the audit record.
4. Findings that remain open, in progress, or accepted are linked to GitHub issues.
5. GitHub Issues and Projects track ownership, priority, milestone, and execution
   status for unresolved audit work.
6. When the work is fixed, the audit record keeps the historical finding and the
   linked GitHub issue is closed or updated with the fix commit.
7. Commits, pushes, PR text, issue comments, and audit-linked issue bodies use the
   configured maintainer or contributor identity, not AI-agent attribution.

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
- Boundary F: Control plane to external provider adapters and provider APIs
- Boundary G: Browser live-observability stream to control plane
- Boundary H: Contributor or automation changes to protected GitHub branches

Each boundary requires authentication, authorization, input validation, and operational logging where applicable.

## 9. Security Architecture

- No raw FreeSWITCH command access for AI agents
- No arbitrary XML editing as a public interface
- Publish lifecycle guarded by validation and optional approvals
- Tenant-scoped or policy-scoped data access
- Full audit trail for state mutations and publish operations
- Provider credentials are write-only secrets and are never exposed through public reads
- Raw provider payloads may be retained only as bounded operational metadata, not as
  authoritative business state

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
- Live operations stream for active calls, active IVR sessions, queue depth,
  runtime health, webhook backlog, and adapter work backlog

## 13. Technology Direction

- Frontend: React + TypeScript
- Main API / Control Plane: Node.js + TypeScript
- Database: PostgreSQL
- Workflow: n8n + Webhooks
- AI: MCP server in TypeScript
- FreeSWITCH Runtime Agent: Go
- FreeSWITCH Call Helper: Lua
- Telecom runtime: FreeSWITCH
- Provider adapters: external workers or plugins behind stable internal contracts

## 14. Architecture Decisions To Track

- Multi-tenant isolation model
- Runtime artifact generation strategy
- Event ingestion topology
- Approval workflow implementation
- Prompt storage and media-serving approach
- Provider credential and adapter installation model
- Channel capability matrix for WhatsApp, Telegram, Google Meet, and custom adapters

## 15. Relationship to Other Documents

- `source-of-truth.md` defines canonical direction and boundaries
- `runtime-boundaries.md` defines what belongs in the API, Go agent, Lua, and FreeSWITCH
- `publishable-object-lifecycle.md` defines desired state, runtime state, lifecycle states, rollback, business events, and runtime-generated artifacts
- `architecture-review-checklist.md` is the contributor checklist for boundary-sensitive changes
- `architecture-drift-risks.md` identifies high-risk drift areas across API, web, MCP, n8n, Go agent, Lua, contracts, and DB
- `../requirements/srs.md` defines what the system must do
- `../design/software-design.md` defines how the software is logically decomposed
