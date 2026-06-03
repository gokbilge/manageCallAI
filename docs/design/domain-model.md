# manageCallAI Domain Model

## 1. Purpose

This document defines the core business domain model for `manageCallAI`.

It describes the primary entities, their responsibilities, key relationships, and invariants that should remain consistent across UI, API, MCP, workflow, and persistence layers.

## 2. Modeling principles

- model telecom intent as business objects rather than raw switch artifacts
- keep desired state separate from generated runtime artifacts
- treat publishable configuration as versioned state where applicable
- make validation, simulation, publish, and rollback explicit lifecycle concepts
- keep the same vocabulary across product surfaces

## 3. Top-level entity groups

### 3.1 Identity and access

- Tenant
- User
- Role
- Policy

### 3.2 Core telecom configuration

- Extension
- SIPTrunk
- PhoneNumber
- InboundRoute
- OutboundRoute
- PromptAsset
- IVRFlow
- FeatureCode
- ParkingLot
- ConferenceRoom
- EndUserSelfServicePolicy

### 3.3 Lifecycle and governance

- FlowVersion
- RouteVersion
- PublishRecord
- ValidationResult
- SimulationResult
- ApprovalRequest
- AuditEvent

### 3.4 Runtime observation

- CallDetailRecord
- CallEvent
- Recording
- RuntimeApplyRequest
- ParkedCall
- ConferenceParticipantSnapshot
- FreeSwitchNode
- FreeSwitchNodeStatusSnapshot

### 3.5 Platform bootstrap

- SetupState

## 4. Core identity entities

### 4.1 Tenant

Represents an isolated customer or logical operating boundary.

Relationships:

- owns users
- owns telecom configuration
- owns audit and operational records

### 4.2 User

Represents a human operator or service identity acting through approved interfaces.

Relationships:

- belongs to one tenant
- has one persisted tenant role
- may own one or more extensions for `/me/*` self-service flows

### 4.3 Role

Represents a bounded application role used to derive capabilities.

Current persisted tenant roles in the code line:

- `tenant_admin`
- `tenant_operator`
- `tenant_viewer`
- `end_user`

`platform_admin` is computed at login from `PLATFORM_OPERATOR_EMAILS` and issued in JWTs rather than stored as a normal tenant role.

## 5. Core telecom entities

### 5.1 Extension

Represents an internal callable identity.

Key implemented fields include:

- `tenantId`
- `extensionNumber`
- `displayName`
- `status`
- `ownerUserId`
- `dndEnabled`
- `callForwardEnabled`
- `callForwardTarget`

Invariants:

- `extensionNumber` is unique within tenant scope
- `callForwardTarget` is blank when call forwarding is disabled

### 5.2 SIPTrunk

Represents an external telephony connectivity definition used by FreeSWITCH.

Sensitive credentials are treated as secret material, not normal public domain fields.

### 5.3 PhoneNumber

Represents a DID or other routable phone number.

### 5.4 InboundRoute

Represents logic for handling inbound calls from a number or trunk context.

### 5.5 OutboundRoute

Represents policy-controlled outbound dialing behavior.

### 5.6 PromptAsset

Represents reusable prompt metadata used by IVR and voicemail surfaces.

### 5.7 IVRFlow

Represents desired-state IVR behavior with draft/version lifecycle, validation, simulation, publish, and rollback operations.

### 5.8 FeatureCode

Represents a tenant-scoped DTMF feature code definition validated and managed by the API, then executed through runtime callbacks.

### 5.9 ParkingLot

Represents a tenant-configured call parking range.

### 5.10 ConferenceRoom

Represents a tenant-scoped conference bridge definition.

### 5.11 EndUserSelfServicePolicy

Represents tenant policy controlling what an `end_user` can change on their own extension.

## 6. Lifecycle and operational entities

### 6.1 FlowVersion and RouteVersion

Represent immutable snapshots used for publish and rollback workflows.

### 6.2 PublishRecord

Represents publish and rollback history.

### 6.3 ValidationResult and SimulationResult

Represent persisted outcomes for validation and simulation runs.

### 6.4 ApprovalRequest

Represents approval-gated publish or rollback operations.

### 6.5 AuditEvent

Represents immutable actor-attributed operational history.

### 6.6 RuntimeApplyRequest

Represents a bounded runtime apply/reload request targeted at a FreeSWITCH node after a desired-state change.

### 6.7 ParkedCall

Represents operational state for a parked call in a parking slot.

### 6.8 ConferenceParticipantSnapshot

Represents normalized participant state observed for a conference room.

### 6.9 FreeSwitchNodeStatusSnapshot

Represents normalized operational status for a FreeSWITCH node as reported by the Go agent, including module, gateway, channel, and registration summaries.

## 7. Platform bootstrap entity

### 7.1 SetupState

Represents platform bootstrap completion state.

The current implementation uses `system_config.setup_complete=true` as the first-run sentinel.
