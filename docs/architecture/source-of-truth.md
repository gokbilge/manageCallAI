# manageCallAI Project Source of Truth

This document is the canonical product, design, and architecture reference for manageCallAI.

If another document conflicts with this one, this document wins until an explicit architecture decision updates it.

## 0. Documentation Authority

Production-readiness work must follow this authority order:

1. `docs/architecture/source-of-truth.md` defines product, design, and architecture intent.
2. ADRs in `docs/adr/` record approved architecture changes or exceptions.
3. `docs/architecture/*`, `docs/design/*`, and `docs/security/*` decompose that intent into implementation boundaries, domain model, runtime boundaries, and security posture.
4. `packages/contracts` defines executable API-facing schemas that must implement the design.
5. `docs/api/openapi.yaml`, generated SDK types, MCP schema checks, and webhook payload checks are generated or drift-checked evidence. They must align with the design and contracts; they do not override architecture.
6. Planning slices under `docs/planning/slices/` define execution order and acceptance criteria. They do not change architecture unless the source-of-truth docs and any required ADRs are updated in the same change.

When production-readiness implementation discovers a conflict, update the design or ADR first, then update contracts, OpenAPI, SDK, MCP, n8n, tests, and docs in that order.

## 1. Purpose

manageCallAI is an open-source telecom control plane built on top of FreeSWITCH.

Its job is to let humans, workflows, and AI agents manage PBX and IVR behavior through safe, high-level abstractions instead of low-level telecom internals.

manageCallAI does not replace FreeSWITCH. It sits above FreeSWITCH as the management, orchestration, API, workflow, and safety layer.

manageCallAI does not fork or replace FreeSWITCH.

It runs on top of stock FreeSWITCH through supported extension interfaces: `mod_xml_curl`, `ESL` / `mod_event_socket`, and Lua helpers.

This is much better for adoption because users can bring their existing FreeSWITCH installation.

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

IVR itself is treated as desired-state flow data with a mandatory lifecycle:

- draft
- validate
- simulate
- approve or policy-check
- publish
- rollback

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

The canonical terminology for desired state, runtime state, lifecycle state,
rollback, business-level events, and runtime-generated artifacts is defined in
`publishable-object-lifecycle.md`.

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

### 6.8 Stock FreeSWITCH First

The platform should use stock FreeSWITCH rather than a project-specific fork.

Project-specific logic should live in external services and minimal integration helpers, not inside a custom FreeSWITCH distribution.

### 6.9 Responsibility Split

- Business logic belongs in the manageCallAI backend.
- AI, MCP, and n8n orchestration logic belongs in the manageCallAI backend.
- Call execution belongs in FreeSWITCH.
- Lua is an optional call-session helper, not a business-logic layer.
- Runtime event and control integration belongs in an external Go or Node agent.

The detailed API, Go agent, Lua, FreeSWITCH, MCP, and n8n boundary rules are
defined in `runtime-boundaries.md`.

### 6.10 Provider-Neutral Integrations

External AI, transcription, text-to-speech, messaging, meeting, and channel systems
are adapter integrations. They must not become mandatory dependencies of the core
control plane.

The public API exposes stable business contracts for work requests, capabilities,
messages, recordings, and results. Provider names such as OpenAI, Whisper,
ElevenLabs, WhatsApp, Telegram, or Google Meet are optional adapter hints, not
required business logic.

Provider credentials are write-only operational secrets. Public responses must not
expose provider secrets, temporary media URLs, raw storage paths, or raw provider
payloads as authoritative domain state.

### 6.11 Production-Readiness Evidence

The project is not production-ready merely because a feature exists. Production
readiness requires repeatable evidence:

- runtime E2E proof over API, PostgreSQL, FreeSWITCH, Lua, Go agent, runtime
  callbacks, event ingestion, observability, and rollback
- tested deployment and network boundaries
- tested backup, restore, upgrade, and rollback procedures
- fraud, abuse, and rate-limit controls suitable for telecom production traffic
- SLOs, alerts, logs, dashboards, and soak/load evidence for runtime paths
- tenant isolation, audit, export, retention, and support-bundle redaction evidence
- versioned SDK, MCP, n8n, OpenAPI, release notes, and compatibility artifacts
- release-candidate governance with signoff, go/no-go, rollback, and monitoring

These gates are tracked by `SLICE-52` through `SLICE-59` and summarized in
`docs/planning/production-readiness-roadmap.md`.

## 7. Canonical System Model

At a high level:

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

## 8. Major Components

### 8.1 React Admin UI

The web UI is the operator-facing management console.

Implementation direction:

- React + TypeScript

Responsibilities:

- Extension management
- DID and route management
- Prompt upload and prompt library browsing
- Visual IVR builder
- Validation and simulation review
- Publish and rollback actions
- Event and call timeline inspection
- Live operations cockpit for active calls, queues, runtime health, and adapter backlog

### 8.2 Control Plane API

The control plane API is the central application layer and system boundary.

Implementation direction:

- Node.js + TypeScript

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

API-facing request and response schemas live in `packages/contracts` as Zod
schemas. `docs/api/openapi.yaml` and `packages/sdk/src/generated/schema.ts` are
generated from those contracts, and CI must fail when the committed OpenAPI
document drifts from generator output.

### 8.3 MCP Server

The MCP server exposes safe tools for AI agents.

Implementation direction:

- TypeScript

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

Implementation direction:

- n8n + Webhooks

Responsibilities:

- Emit business-level telecom events
- Allow approved automation to create drafts
- Trigger downstream CRM/helpdesk/ops automations

### 8.5 Provider Integration Layer

The provider integration layer connects the control plane to optional external AI,
media, messaging, meeting, and channel systems.

Implementation direction:

- Adapter workers or plugins outside the domain core and outside the API process
- Internal claim/result endpoints for asynchronous processing
- Capability flags for provider-specific feature differences

Responsibilities:

- Process recording transcription and summarization requests
- Generate IVR prompt audio through optional text-to-speech providers
- Resolve AI-assisted IVR turns when a flow explicitly delegates a question or request
- Send and ingest channel messages through provider adapters
- Represent channel voice, voice-message, meeting, or SIP-bridge sessions without
  assuming every provider supports every capability

WhatsApp, Telegram, Google Meet, and custom channel implementations are external
adapter services. manageCallAI stores channel accounts, normalized messages,
meeting/session records, and provider-neutral work state; it does not embed
provider SDKs, provider webhooks, token refresh loops, or delivery workers in
the control-plane API.

Constraints:

- No provider-specific payload shape becomes the canonical business object
- No provider integration bypasses validation, audit, tenant scoping, or policy
- A missing provider implementation must leave the contract valid but the work
  request unprocessed or explicitly failed

### 8.6 PostgreSQL

PostgreSQL stores the canonical desired state and operational metadata.

Responsibilities:

- Configuration state
- Version history
- Audit records
- Simulation records
- CDR ingestion results
- Call event timeline data
- Recording, AI work request, prompt-generation, IVR AI, and channel-adapter metadata

### 8.7 FreeSWITCH Adapter Layer

This layer translates desired state into runtime behavior that FreeSWITCH can consume.

Implementation direction:

- Go adapter service outside FreeSWITCH
- Lua call helper scripts inside the FreeSWITCH boundary

Likely mechanisms:

- `mod_xml_curl` for dynamic dialplan and directory generation
- ESL consumers for event ingestion and runtime actions
- Lua helper scripts when needed inside the FreeSWITCH boundary

Responsibilities:

- Render active state into FreeSWITCH-compatible responses
- Enforce stable translation from business objects to telecom artifacts
- Ingest events back into the control plane
- Keep project-specific logic outside stock FreeSWITCH

For MVP, Lua should be limited to:

- `play_collect`
- `play_prompt`
- `transfer`
- `hangup`
- `set_variable`
- call API for next step

Do not put business logic in Lua.

### 8.8 FreeSWITCH Runtime

FreeSWITCH remains responsible for:

- SIP signaling
- RTP/media handling
- Real-time call execution
- Runtime telecom primitives
- Executing Lua call helper logic inside the switch boundary

Example Lua action payload:

```json
{
  "action": "play_collect",
  "prompt": "main_menu_tr.wav",
  "maxDigits": 1,
  "timeoutMs": 5000
}
```

Lua executes the requested action and reports the result back.

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
- Recording
- Recording analysis request
- Prompt generation request
- IVR AI turn request
- Channel account
- Channel message
- Channel voice session

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

IVR flow graphs must not be treated as raw FreeSWITCH XML fragments. They are
tenant-scoped business objects whose active versions are projected into runtime behavior only after validation and publish.

IVR graph semantics may follow a constrained BPMN-inspired model: start event,
action task, exclusive gateway, sequence flow, and terminal event. Full BPMN 2.0
is not the runtime engine, and BPMN XML must not become the canonical persisted
format unless a later ADR explicitly changes that boundary.

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

### 11.1 First Vertical Slice

The first implementation slice should prove the architecture end to end with the smallest useful telecom loop:

1. Create extension in API
2. Store extension in PostgreSQL
3. Serve extension directory via `mod_xml_curl`
4. Register SIP phone to FreeSWITCH
5. Ingest registration or call event
6. Show call event through API

This slice proves:

- The backend can own business state
- PostgreSQL is the source of truth
- FreeSWITCH can consume runtime state through supported extension interfaces
- The adapter and event-ingestion layer work
- The API can expose observed runtime behavior back to the user

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
- Live observability streams must enforce the same tenant and role boundaries as
  REST reads, and must not stream raw provider secrets or raw switch payloads

Outbound dispatch must fail closed. Calls without an active route are rejected, and
route-level destination allowlists/blocklists plus global emergency and premium-rate
blocks are enforced before a runtime request is queued.

## 13. API Design Rules

The API should expose business objects and business actions, not FreeSWITCH internals.

Preferred API shape:

- `extensions`
- `trunks`
- `numbers`
- `routes`
- `flows`
- `prompts`
- `prompt-generation`
- `simulations`
- `publishes`
- `events`
- `recordings`
- `recording-analysis`
- `runtime/ivr-ai`
- `channels`

Avoid API designs centered on:

- Raw dialplan fragments
- Arbitrary XML payloads
- ESL command passthrough
- Runtime-specific switch internals as first-class public objects
- Provider-specific AI, media, or channel payloads as canonical domain objects

## 14. MCP Design Rules

MCP tooling must stay narrower than the REST API.

n8n and workflow automation surfaces follow the same safety rule: they operate
on business events and approved API workflows, not raw FreeSWITCH, raw XML, raw
ESL, or shell-like runtime control.

Initial MCP categories:

- Read current extensions, routes, and flow summaries
- Create or edit draft flows
- Validate draft flows
- Simulate proposed call behavior
- Request publish of already validated drafts

Rules:

- Tools should be intent-based
- Tool inputs must be schema-validated
- Tool schemas should be generated from, imported from, or drift-tested against
  shared REST/IVR contracts rather than hand-maintained independently
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

- `README.md` explains the project and links to canonical docs
- `docs/architecture/source-of-truth.md` is the main architecture and design reference
- Future ADRs should capture explicit deviations or decisions not already frozen here

Suggested future supporting docs:

- `docs/adr/`
- `docs/adr/README.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `LICENSE`
- `docs/README.md`
- `docs/requirements/srs.md`
- `docs/design/domain-model.md`
- `docs/api/rest-api.md`
- `docs/design/database-schema.md`
- `docs/design/software-design.md`
- `docs/architecture/overview.md`
- `docs/api/`
- `docs/examples/`

## 18. Technology Direction

- Frontend: React + TypeScript
- Main API / Control Plane: Node.js + TypeScript
- Database: PostgreSQL
- Workflow: n8n + Webhooks
- AI: MCP server in TypeScript
- AI/media/channel providers: optional adapter workers or plugins
- FreeSWITCH Runtime Agent: Go
- FreeSWITCH Call Helper: Lua

## 19. Roadmap

### Priority Implementation Order

1. PostgreSQL migration runnable
2. Node.js API health + extensions CRUD
3. FreeSWITCH `mod_xml_curl` directory endpoint
4. Go adapter connects to ESL and logs events
5. Lua helper only for `play_prompt` / `play_collect`
6. OpenAPI generated client
7. MCP read-only tools
8. Flow draft / validate / simulate
9. Publish active version
10. n8n webhook examples

This order is the preferred execution path for proving the platform architecture incrementally.

### Milestone 1: FreeSWITCH Control Plane

- Dynamic extension lookup
- Dynamic inbound routing
- Basic outbound routing
- CDR ingestion
- Call event timeline

Milestone 1 should begin with the first vertical slice above before broader IVR or routing depth.

### Milestone 2: Visual IVR

- Flow schema
- Visual builder
- BPMN-inspired graph semantics over the existing desired-state model
- Shared execution planner for validation, simulation, runtime resolution, and replay
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
- Live operations cockpit with tenant-scoped WebSocket/SSE observability
- Production runtime E2E release gate
- Deployment, network, SIP/TLS/SRTP/NAT, backup, restore, upgrade, and rollback
  procedures
- Toll-fraud, abuse, external rate-limit store, SLO, soak, tenant-isolation
  evidence, release packaging, and release-candidate governance

### Milestone 6: Provider and Omnichannel Contracts

- Durable recording metadata and analysis work requests
- Provider-neutral transcription and summarization contract
- Provider-neutral prompt generation and text-to-speech contract
- IVR AI turn delegation contract for customer questions or requests
- Channel account, message, voice-message, meeting, and SIP-bridge adapter contracts

This milestone defines integration contracts first. Concrete provider adapters may
arrive later without changing the business API.

## 20. Open Questions

These are not resolved by the current design and should be tracked explicitly as decisions:

- Whether the provisional Apache-2.0 license should remain the long-term license
- Exact multi-tenant model after MVP
- Whether outbound calling policy is route-based, tenant-policy-based, or both
- Prompt storage strategy
- Simulation engine depth and fidelity
- Approval workflow model for human-in-the-loop publishing
- Event ingestion and retention policy

## 21. Change Control

This document should change when the architecture changes, not after.

If a proposed implementation conflicts with this document, one of two things must happen:

1. The implementation changes to match the document.
2. The document is updated first with the new intended design.

For major changes, add an ADR and update this file in the same pull request.
