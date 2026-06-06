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

Planned enterprise-model additions tracked in `#300` through `#315`:

- NumberingPlan
- NumberingPlanRule
- CallingPolicy
- Site
- Location
- NetworkZone
- TrunkGroup
- RouteList
- Device
- LineAppearance
- ScheduleGroup
- HolidayCalendar

Planned migration/adoption entities:

- MigrationSource
- CanonicalMigrationSnapshot
- CompatibilityReport
- ManualReviewItem
- MigrationDraftImport
- MigrationEvidenceBundle

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

Planned evolution:

- `#308` through `#310` split extension relationships more explicitly from user
  identity and device ownership

### 5.2 SIPTrunk

Represents an external telephony connectivity definition used by FreeSWITCH.

Sensitive credentials are treated as secret material, not normal public domain fields.

### 5.3 PhoneNumber

Represents a DID or other routable phone number.

### 5.4 InboundRoute

Represents logic for handling inbound calls from a number or trunk context.

### 5.5 OutboundRoute

Represents policy-controlled outbound dialing behavior.

Planned evolution:

- `#300` through `#307` move outbound decisioning onto explicit numbering,
  calling-policy, site, and trunk-group concepts instead of route-only logic

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

## 5.12 Planned enterprise entities

### NumberingPlan and NumberingPlanRule

Planned in `#300` and `#302` to model enterprise dialing intent explicitly.

### CallingPolicy

Planned in `#301` and `#302` to model outbound permissions and exception rules
separately from route records.

### Site, Location, and NetworkZone

Planned in `#303` and `#304` to model enterprise topology, timezone, language,
and emergency defaults.

### TrunkGroup and RouteList

Planned in `#305` through `#307` to model failover-aware carrier selection.

### Device and LineAppearance

Planned in `#308` through `#315` to separate endpoint ownership and device
presentation from the flat extension-centric baseline.

### ScheduleGroup and HolidayCalendar

Implemented in `#311` and `#312` through the `/schedules` aggregate, which now
acts as the schedule-group resource while preserving backward compatibility for
existing IVR `schedule_id` references.

The aggregate now models:

- recurring weekly business-hours rules
- legacy inline holiday overrides for compatibility
- explicit holiday-calendar child resources
- temporary override records with expiry and cancellation metadata

Timezone-aware multi-site evaluation remains the later `#313` lane.

### MigrationSource and CanonicalMigrationSnapshot

Planned for the post-`v0.8.x` migration-assistant lane to represent source
metadata, normalized imported inventory, source references, hashes, confidence
scores, and unsupported-item inventories.

### CompatibilityReport and ManualReviewItem

Planned to capture exact/equivalent/approximate/manual/unsupported/unknown
classification for source objects, plus operator-visible rationale.

### MigrationEvidenceBundle

Planned to capture source snapshot hash, compatibility output, draft object
references, validation/simulation results, manual review decisions, cutover
checklist state, runtime smoke evidence, and rollback guidance.

## 8. Migration and Adoption Toolkit

manageCallAI will support migration through a staged, evidence-based process:
source discovery, compatibility analysis, draft import, validation, simulation,
operator approval, cutover checklist, runtime smoke, and rollback evidence.

The importer must not auto-publish live objects or execute source custom logic.

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
