# manageCallAI Domain Model

## 1. Purpose

This document defines the core business domain model for `manageCallAI`.

It describes the primary entities, their responsibilities, key relationships, lifecycle states, and model invariants that should remain consistent across UI, API, MCP, workflow, and persistence layers.

## 2. Modeling Principles

- Model telecom intent as business objects rather than raw switch artifacts
- Keep desired state separate from generated runtime artifacts
- Treat publishable configuration as versioned state
- Make validation, simulation, publish, and rollback explicit lifecycle concepts
- Keep the same vocabulary across product surfaces

## 3. Top-Level Entity Groups

### 3.1 Identity and Access

- Tenant
- User
- Role
- Policy

### 3.2 Core Telecom Configuration

- Extension
- SIPTrunk
- PhoneNumber
- InboundRoute
- OutboundRoute
- PromptAsset
- IVRFlow

### 3.3 Lifecycle and Governance

- FlowVersion
- RouteVersion
- PublishRecord
- ValidationResult
- SimulationResult
- ApprovalRequest
- AuditEvent

### 3.4 Runtime Observation

- CallDetailRecord
- CallEvent
- RuntimeIngestionRecord

## 4. Core Entities

### 4.1 Tenant

Represents an isolated customer or logical operating boundary.

Key fields:

- `id`
- `name`
- `slug`
- `status`
- `createdAt`
- `updatedAt`

Relationships:

- Owns users
- Owns telecom configuration
- Owns audit and operational records

Notes:

- MVP may begin as single-tenant, but the domain should avoid hard-coding global ownership assumptions.

### 4.2 User

Represents a human operator or service identity acting through approved interfaces.

Key fields:

- `id`
- `tenantId`
- `email`
- `displayName`
- `status`
- `lastLoginAt`
- `createdAt`
- `updatedAt`

Relationships:

- Belongs to one tenant
- Has one or more roles or policies
- Creates or modifies configuration and audit records

### 4.3 Role

Represents a named authorization grouping for administrative actions.

Key fields:

- `id`
- `tenantId`
- `name`
- `description`

Relationships:

- Assigned to users
- Maps to policy capabilities

### 4.4 Policy

Represents capability restrictions or safety rules applied to users, automations, or publish operations.

Key fields:

- `id`
- `tenantId`
- `name`
- `policyType`
- `rules`
- `status`

Relationships:

- Can be attached to roles
- Can gate publish or outbound routing actions

## 5. Telecom Configuration Entities

### 5.1 Extension

Represents an internal callable identity.

Key fields:

- `id`
- `tenantId`
- `extensionNumber`
- `displayName`
- `status`
- `defaultDestinationType`
- `defaultDestinationId`
- `createdAt`
- `updatedAt`

Relationships:

- May route to an IVR flow, user endpoint, queue, or other supported destination
- Can be referenced by inbound or outbound routing logic

Invariants:

- `extensionNumber` must be unique within tenant scope
- Inactive extensions must not be selected as active destinations unless explicitly allowed by policy

### 5.2 SIPTrunk

Represents an external telephony connectivity definition used by FreeSWITCH.

Key fields:

- `id`
- `tenantId`
- `name`
- `direction`
- `status`
- `providerName`
- `authenticationProfile`
- `networkProfile`
- `createdAt`
- `updatedAt`

Relationships:

- Referenced by inbound and outbound routing

Notes:

- Sensitive credentials should not be treated as plain domain fields in public interfaces.

### 5.3 PhoneNumber

Represents a DID or other routable phone number.

Key fields:

- `id`
- `tenantId`
- `e164Number`
- `displayLabel`
- `status`
- `assignedTargetType`
- `assignedTargetId`
- `trunkId`
- `createdAt`
- `updatedAt`

Relationships:

- May be associated with a SIP trunk
- May map to an inbound route or another supported destination

Invariants:

- `e164Number` must be unique within relevant ownership scope

### 5.4 InboundRoute

Represents logic for handling inbound calls from a number or trunk context.

Key fields:

- `id`
- `tenantId`
- `name`
- `matchType`
- `matchValue`
- `targetType`
- `targetId`
- `status`
- `draftVersionId`
- `activeVersionId`
- `createdAt`
- `updatedAt`

Relationships:

- References destination objects such as extension or IVR flow
- Has version history through route versions

Invariants:

- An active route must reference a valid active destination
- Conflicting active matches must be rejected by validation

### 5.5 OutboundRoute

Represents policy-controlled outbound dialing behavior.

Key fields:

- `id`
- `tenantId`
- `name`
- `matchStrategy`
- `destinationPattern`
- `trunkSelectionStrategy`
- `status`
- `draftVersionId`
- `activeVersionId`
- `createdAt`
- `updatedAt`

Relationships:

- References one or more trunks
- Governed by outbound safety policies

Invariants:

- Active outbound routes must conform to destination allowlists and policy constraints

### 5.6 PromptAsset

Represents an audio or prompt artifact used by IVR flows.

Key fields:

- `id`
- `tenantId`
- `name`
- `mediaType`
- `language`
- `storageUri`
- `checksum`
- `status`
- `createdAt`
- `updatedAt`

Relationships:

- Referenced by IVR flow nodes or prompts

Invariants:

- Referenced active prompts must exist and be retrievable

### 5.7 IVRFlow

Represents a publishable call-flow definition.

Key fields:

- `id`
- `tenantId`
- `name`
- `description`
- `status`
- `draftVersionId`
- `activeVersionId`
- `createdAt`
- `updatedAt`

Relationships:

- Owns many flow versions
- References prompt assets, routes, transfer targets, and branch logic

Invariants:

- Only one active version may exist per flow at a time
- Draft and active versions must remain explicitly distinguishable

## 6. Versioned Entities

### 6.1 FlowVersion

Represents a versioned snapshot of an IVR flow.

Key fields:

- `id`
- `flowId`
- `versionNumber`
- `state`
- `definition`
- `createdBy`
- `createdAt`
- `validatedAt`
- `simulatedAt`
- `publishedAt`

States:

- `draft`
- `validated`
- `simulated`
- `published`
- `superseded`
- `rolled_back`

Invariants:

- `versionNumber` must increase monotonically per flow
- Published versions must have passed validation

### 6.2 RouteVersion

Represents a versioned snapshot for inbound or outbound routing definitions where publish history matters.

Key fields:

- `id`
- `routeType`
- `routeId`
- `versionNumber`
- `state`
- `definition`
- `createdBy`
- `createdAt`
- `validatedAt`
- `publishedAt`

## 7. Governance and Lifecycle Entities

### 7.1 PublishRecord

Represents an immutable record of a publish or rollback event.

Key fields:

- `id`
- `tenantId`
- `objectType`
- `objectId`
- `versionId`
- `actionType`
- `triggeredByType`
- `triggeredById`
- `approvalRequestId`
- `result`
- `createdAt`

Relationships:

- Links a publishable object version to an actor and outcome

### 7.2 ValidationResult

Represents the result of a validation run against a draft or versioned object.

Key fields:

- `id`
- `tenantId`
- `objectType`
- `objectId`
- `versionId`
- `validatorVersion`
- `status`
- `errors`
- `warnings`
- `createdAt`

Statuses:

- `passed`
- `failed`
- `warning_only`

### 7.3 SimulationResult

Represents the result of a simulation run.

Key fields:

- `id`
- `tenantId`
- `objectType`
- `objectId`
- `versionId`
- `scenario`
- `status`
- `resultPayload`
- `createdAt`

Statuses:

- `passed`
- `failed`
- `inconclusive`

### 7.4 ApprovalRequest

Represents a human or policy-gated approval step for risky operations.

Key fields:

- `id`
- `tenantId`
- `objectType`
- `objectId`
- `versionId`
- `requestedBy`
- `status`
- `decisionBy`
- `decisionAt`
- `reason`
- `createdAt`

Statuses:

- `pending`
- `approved`
- `rejected`
- `expired`

### 7.5 AuditEvent

Represents a durable audit trail event for domain mutations or sensitive reads.

Key fields:

- `id`
- `tenantId`
- `actorType`
- `actorId`
- `action`
- `objectType`
- `objectId`
- `metadata`
- `createdAt`

Actor types:

- `user`
- `workflow`
- `ai_agent`
- `system`

## 8. Runtime Observation Entities

### 8.1 CallDetailRecord

Represents a normalized record of a completed or observed call.

Key fields:

- `id`
- `tenantId`
- `callId`
- `direction`
- `fromNumber`
- `toNumber`
- `startTime`
- `endTime`
- `durationSeconds`
- `terminationReason`
- `finalDisposition`
- `ingestedAt`

### 8.2 CallEvent

Represents a normalized event in the call lifecycle.

Key fields:

- `id`
- `tenantId`
- `callId`
- `eventType`
- `eventTime`
- `source`
- `payload`
- `ingestedAt`

### 8.3 RuntimeIngestionRecord

Represents a technical record of adapter ingestion work for traceability.

Key fields:

- `id`
- `sourceType`
- `sourceReference`
- `status`
- `receivedAt`
- `processedAt`
- `errorMessage`

## 9. Relationship Summary

At a high level:

```text
Tenant
  -> User
  -> Role
  -> Policy
  -> Extension
  -> SIPTrunk
  -> PhoneNumber
  -> InboundRoute
  -> OutboundRoute
  -> PromptAsset
  -> IVRFlow
  -> PublishRecord
  -> ValidationResult
  -> SimulationResult
  -> ApprovalRequest
  -> AuditEvent
  -> CallDetailRecord
  -> CallEvent

IVRFlow
  -> FlowVersion

InboundRoute / OutboundRoute
  -> RouteVersion

FlowVersion / RouteVersion
  -> ValidationResult
  -> SimulationResult
  -> PublishRecord
  -> ApprovalRequest
```

## 10. Lifecycle Rules

### 10.1 Publishable Object Lifecycle

Suggested lifecycle:

1. Draft created
2. Draft edited
3. Validation executed
4. Simulation executed where applicable
5. Approval requested if required
6. Version published
7. Prior version remains rollback-capable

### 10.2 State Transition Rules

- A `draft` version may transition to `validated` only if validation passes
- A `validated` version may transition to `published` directly or after simulation and approval depending on policy
- A `published` version may transition to `superseded` when replaced by a newer active version
- A prior `published` or `superseded` version may become active again through rollback

## 11. Domain Invariants

- There is exactly one canonical desired-state owner for each configuration object
- Active versions are explicit, never implicit
- Publish actions are auditable and attributable
- AI-facing operations must remain within the constrained business vocabulary
- Runtime artifacts are derived outputs, not canonical domain entities

## 12. Mapping Guidance

### 12.1 API Mapping

- Public endpoints should expose these domain nouns directly
- Public payloads should avoid leaking FreeSWITCH-specific implementation details unless operationally necessary

### 12.2 Database Mapping

- Tables may be normalized differently from the conceptual model, but ownership and invariants must remain intact
- Versioned object content may be stored in structured relational or document-like form as long as validation and auditability remain strong

### 12.3 UI Mapping

- UI terminology should mirror domain terms such as flow, route, prompt, validation, simulation, publish, and rollback

## 13. Open Modeling Questions

- Final queue, ring group, and agent abstractions if call-center features are added
- Whether routes share one generic versioning model or distinct inbound and outbound version types
- Final approval policy attachment model
- Exact representation of IVR node graphs and simulation scenarios
