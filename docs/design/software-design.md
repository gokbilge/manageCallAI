# manageCallAI Software Design Description

## 1. Purpose

This document describes the logical software design of `manageCallAI`, including core modules, responsibilities, data ownership, and internal interfaces.

## 2. Design goals

- keep business intent separate from telecom runtime mechanisms
- centralize validation, simulation, and publish control in the application layer
- use one domain vocabulary across UI, API, MCP, workflow, and persistence layers
- make risky operations explicit, auditable, and reversible
- keep integration adapters replaceable without rewriting core business logic

## 3. Logical subsystems

### 3.1 Admin UI

- React + TypeScript
- presents operator workflows for extension, route, prompt, PBX, and IVR management
- displays validation, simulation, publish, rollback, and observability state

### 3.2 Control plane API

- Node.js + TypeScript
- Fastify route modules registered in `apps/api/src/app.ts`
- exposes business capabilities to UI and external clients
- enforces authentication, authorization, and runtime auth
- coordinates domain services
- owns setup/bootstrap lifecycle gating through `system_config` and `SETUP_*`

### 3.3 Domain services

- implement business rules
- own validation orchestration
- own simulation orchestration
- own publish and rollback lifecycle logic
- enforce invariants for publishable objects

### 3.4 Persistence layer

- persists desired state
- persists version history
- persists validation and simulation outcomes
- persists audit and runtime observation records

### 3.5 FreeSWITCH adapter layer

- Go adapter service
- thin Lua helper scripts inside FreeSWITCH where needed
- translates active published state into FreeSWITCH-compatible runtime artifacts
- ingests switch events and CDRs
- posts bounded runtime health and status observations to the API

Lua stays limited to constrained runtime execution such as prompt playback, DTMF collection, transfer, hangup, and reporting outcomes. It must not contain tenant policy, publish logic, or graph traversal.

### 3.6 MCP server

- TypeScript
- exposes safe tools for AI agents
- narrower than REST
- marshals MCP requests into API/domain operations

### 3.7 Workflow integration layer

- n8n and webhooks
- emits business events
- accepts approved automation entry points
- keeps workflow access narrower than REST

### 3.8 Setup and bootstrap layer

- `apps/api/src/modules/setup`
- startup hook in `apps/api/src/app.ts` and `apps/api/src/server.ts`
- production packaging in Compose, install script, and Helm scaffold

Responsibilities:

- gate first-run installation with `system_config.setup_complete`
- provide browser-based `/setup` flow when headless bootstrap is not configured
- provide env-var-based headless bootstrap for containerized deployments
- create the bootstrap tenant and initial admin through API-owned validation and persistence rules
- remove the setup surface after completion

### 3.9 AI assistance layer

`v0.6.x` operator-facing AI workflows remain API-owned domain features.

Responsibilities:

- explain call failures from normalized call events, route state, and runtime facts
- summarize route and publish risk from existing desired-state and publish records
- generate voicemail and call summaries from bounded recording-analysis outputs
- translate natural-language operator questions into bounded reporting queries
- enforce provider-backed AI policy boundaries before tenant or runtime requests
  enter provider-neutral work queues
- preserve tenant scoping, capability checks, audit attribution, and idempotent request handling

Non-responsibilities:

- direct runtime control
- direct SQL generation or execution
- autonomous publish or rollback
- provider-specific coupling inside the core domain model

Current implementation status:

- deterministic `v0.6.0` advisory features are implemented as bounded API
  services
- `v0.6.1` introduces platform policy plus tenant opt-in for provider-backed
  prompt generation and IVR AI execution
- the same policy foundation now governs optional provider-backed recording
  transcript and summary analysis requests
- provider-backed execution still resolves through provider-neutral work-request
  contracts and can fall back to deterministic `auto` mode when policy forbids it

### 3.10 Release evidence layer

- validators and smoke scripts under `scripts/`
- release and operations documentation under `docs/release/` and `docs/ops/`
- GitHub Actions for CI, image builds, CodeQL, and runtime smoke workflows

Responsibilities:

- distinguish implementation, documentation, check-config validation, and real release evidence
- require runtime, restore, soak/SLO, security, carrier, and operator-signoff artifacts before production promotion
- keep release manifests tied to the exact candidate commit or workflow run

## 4. Core domain concepts

### 4.1 Configuration objects

- extension
- SIP trunk
- phone number
- inbound route
- outbound route
- prompt asset
- IVR flow
- feature code
- parking lot
- conference room
- end-user self-service policy

### 4.2 Operational objects

- flow version
- route version
- publish record
- validation result
- simulation result
- audit event
- call event
- call detail record
- recording
- parked call
- conference participant snapshot
- runtime apply request
- FreeSWITCH node status snapshot
- setup sentinel state

## 5. Service decomposition

The current code line is organized around route modules plus service/repository classes. The implementation includes or clearly implies services in these areas:

- `AuthService`
- `ExtensionService`
- `TrunkService`
- `RouteService`
- `PromptService`
- `FlowService`
- `ValidationService`
- `SimulationService`
- `PublishService`
- `AuditService`
- `FeatureCodeService`
- `ParkingLotService`
- `ConferenceRoomService`
- `SelfServiceService`
- `RuntimeNodeStatusService`
- `SetupService`
- `AiPolicyService`
- planned `CallFailureExplanationService`
- planned `RouteRiskAnalysisService`
- `RecordingSummaryService` behavior currently lives inside the recordings and
  voicemail service boundary, exposing bounded summary review for recordings,
  call-detail lookups, and voicemail-linked media review
- planned `NaturalLanguageReportingService`

## 6. Design constraints

- business logic stays in TypeScript services, not Lua, the Go agent, MCP, or n8n
- FreeSWITCH integration uses stock interfaces
- runtime-generated artifacts are derived from active desired state
- MCP and n8n must not expose raw ESL, raw XML, shell, SQL, or direct runtime control
- release stage claims require evidence outside the code itself
- AI assistance must remain advisory unless the normal lifecycle explicitly turns
  a result into a validated, simulated, approved, and published change
