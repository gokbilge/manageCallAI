# manageCallAI Software Design Description

## 1. Purpose

This document describes the logical software design of `manageCallAI`, including core modules, responsibilities, data ownership, workflows, and internal interfaces.

It translates the product and architectural intent into implementable software structure.

## 2. Design Goals

- Keep business intent separate from telecom runtime mechanisms
- Centralize validation, simulation, and publish control in the application layer
- Use a single domain vocabulary across UI, API, MCP, workflow, and persistence layers
- Make risky operations explicit, auditable, and reversible
- Keep integration adapters replaceable without rewriting core business logic

## 3. Logical Subsystems

### 3.1 Admin UI

Implementation direction:

- React + TypeScript

Responsibilities:

- Present operator workflows for extension, route, prompt, and IVR management
- Display validation and simulation results
- Support publish and rollback actions
- Surface audit and call-event visibility

### 3.2 Control Plane API

Implementation direction:

- Node.js + TypeScript

Responsibilities:

- Expose application capabilities to UI and external clients
- Enforce authentication and authorization
- Coordinate domain services
- Return business-level representations and action results

### 3.3 Domain Services

Responsibilities:

- Implement business rules
- Own validation orchestration
- Own simulation orchestration
- Own publication and rollback lifecycle logic
- Enforce invariants for publishable objects

### 3.4 Persistence Layer

Responsibilities:

- Persist desired state
- Persist publishable versions
- Persist validation and simulation outcomes
- Persist audit and event records

### 3.5 FreeSWITCH Adapter Layer

Implementation direction:

- Go runtime agent
- Lua helper scripts inside FreeSWITCH where needed

Responsibilities:

- Translate active published state into FreeSWITCH-compatible runtime artifacts
- Ingest switch events and CDRs
- Keep adapter-specific logic isolated from the core domain model

### 3.6 MCP Server

Implementation direction:

- TypeScript

Responsibilities:

- Expose safe tools for AI agents
- Narrow action surface compared with REST API
- Marshal MCP requests into domain service operations

### 3.7 Workflow Integration Layer

Implementation direction:

- n8n + Webhooks

Responsibilities:

- Emit business events
- Accept approved automation entry points
- Bridge external workflow systems to control-plane operations

## 4. Core Domain Concepts

### 4.1 Configuration Objects

- Extension
- SIP trunk
- DID / phone number
- Inbound route
- Outbound route
- Prompt asset
- IVR flow

### 4.2 Operational Objects

- Flow version
- Publish record
- Validation result
- Simulation result
- Audit event
- Call event
- Call detail record

### 4.3 Publishable Object Pattern

Each publishable object should support:

- Draft content
- Validation status
- Simulation status where relevant
- Version history
- Active published version pointer
- Rollback target selection

## 5. Design Decomposition

### 5.1 API Module

Key design responsibilities:

- Request parsing and authentication
- Authorization checks
- Input schema validation
- Routing to application services
- Response shaping

### 5.2 Application Service Module

Key design responsibilities:

- Transaction boundary management
- Coordination between repositories and domain services
- Audit event creation
- Publish lifecycle orchestration

Likely services:

- `ExtensionService`
- `TrunkService`
- `RouteService`
- `PromptService`
- `FlowService`
- `ValidationService`
- `SimulationService`
- `PublishService`
- `AuditService`

### 5.3 Domain Rule Module

Key design responsibilities:

- Enforce allowed transitions between draft, validated, simulated, and published states
- Enforce object-specific constraints
- Evaluate route safety and structural consistency
- Ensure AI-facing operations stay within safe policy boundaries

### 5.4 Repository Module

Key design responsibilities:

- Encapsulate persistence details
- Load and save versioned domain objects
- Query audit, call event, and validation history

### 5.5 Renderer Module

Key design responsibilities:

- Convert active published state to FreeSWITCH-facing materialized output
- Keep deterministic output generation
- Avoid exposing internal storage forms directly to runtime consumers

### 5.6 Event Ingestion Module

Key design responsibilities:

- Consume CDRs and switch events
- Normalize runtime data into domain-level event records
- Preserve raw references only where operationally needed

## 6. Key Workflows

### 6.1 Draft Editing Workflow

1. User or approved automation creates or updates a draft object.
2. The API stores updated desired state in the database.
3. The system records an audit event.

### 6.2 Validation Workflow

1. A validation request targets a draft object.
2. Structural and business rule validators execute.
3. Validation results are persisted.
4. The outcome is returned to the caller and available for later inspection.

### 6.3 Simulation Workflow

1. A simulation request targets a draft object or route scenario.
2. The simulation engine evaluates expected call behavior.
3. The simulation result is stored.
4. The result is presented through UI, API, or MCP.

### 6.4 Publish Workflow

1. A publish request targets a validated object.
2. Approval policy is checked if required.
3. The system creates or activates a new published version.
4. The renderer exposes the active state to runtime consumers.
5. The system records audit and publish records.

### 6.5 Rollback Workflow

1. A rollback request selects a prior publishable version.
2. Policy checks are applied.
3. The selected version becomes active.
4. The renderer updates runtime-facing outputs.
5. The system records rollback audit data.

## 7. Interface Design Principles

### 7.1 REST API

- Use business nouns and business actions
- Avoid raw switch internals as first-class public objects
- Keep publish, validate, and simulate as explicit lifecycle operations

### 7.2 MCP Tools

- Use intent-based tool names
- Use schema-validated structured inputs
- Return concise, machine-usable outputs
- Block unrestricted switch-level operations

### 7.3 Webhooks and Workflow Endpoints

- Prefer business-level event semantics
- Keep payloads stable and auditable
- Avoid forcing workflow users to understand raw switch events

## 8. Persistence Design

### 8.1 Canonical Data Ownership

The control plane database owns the desired state for telecom intent.

FreeSWITCH consumes generated active state and does not own business intent.

### 8.2 Persistence Categories

- Configuration tables
- Version tables
- Validation and simulation tables
- Audit tables
- Runtime event and CDR tables

### 8.3 Persistence Rules

- Writes occur to desired state first
- Publish activates a version pointer rather than mutating runtime state directly
- Runtime artifacts should be reproducible from persisted active state

## 9. Error Handling Design

- Validation errors should be explicit and user-correctable
- Publish failures should not partially activate inconsistent state
- Integration failures should be visible through logs, status surfaces, and audit records
- Unsafe operations should fail closed

## 10. Security Design

- Enforce authentication at all protected boundaries
- Apply authorization before state mutation
- Restrict AI and automation surfaces by capability and policy
- Maintain complete auditability for mutation workflows

## 11. Design Risks

- Over-coupling the domain model to FreeSWITCH-specific runtime details
- Making the MCP surface too broad
- Treating simulation as a shallow syntax check instead of behavioral evaluation
- Allowing draft and publish lifecycle rules to diverge across interfaces

## 12. Open Design Items

- Final multi-tenant model
- Outbound calling safety policy model
- Prompt storage implementation details
- Depth and fidelity of the simulation engine
- Approval workflow mechanics for risky publish operations
