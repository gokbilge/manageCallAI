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
- AuditFinding
- IssueReference

### 3.4 Runtime Observation

- CallDetailRecord
- CallEvent
- Recording
- RecordingAnalysisRequest
- RuntimeIngestionRecord

### 3.5 Provider and Channel Integration

- PromptGenerationRequest
- IvrAiTurnRequest
- ChannelAccount
- ChannelMessage
- ChannelVoiceSession

### 3.6 Production Readiness Evidence

- ReleaseCandidate
- RuntimeE2EEvidence
- DeploymentPreflightResult
- RestoreSmokeResult
- SoakTestResult
- ComplianceEvidence

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

### 4.5 AuditFinding

Represents a discrete issue discovered during an audit.

Key fields:

- `id`
- `auditFile`
- `title`
- `severity`
- `status`
- `location`
- `finding`
- `fix`
- `resolvedCommit`
- `issueUrl`

Relationships:

- Belongs to one audit record
- May link to one GitHub issue when unresolved after the audit session

Invariants:

- Findings are never deleted from audit records
- Unresolved findings must have a GitHub issue or a documented reason why an
  existing issue already tracks the same risk
- Issue links must be updated when findings are resolved or accepted

### 4.6 IssueReference

Represents the GitHub tracking link for unresolved audit work.

Key fields:

- `url`
- `number`
- `state`
- `labels`
- `milestone`
- `project`

Relationships:

- Tracks one or more related audit findings
- May be closed when all linked findings are resolved

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
- `allowedDestinationPrefixes`
- `blockedDestinationPrefixes`
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
- Outbound calls without an active matching route are rejected before dispatch
- Emergency and premium-rate destinations are blocked by global safety policy

### Queue Runtime Policy

Represents desired-state queue behavior for call-center style routing.

Key fields:

- `ringTimeoutSeconds`
- `retryDelaySeconds`
- `maxWaitSeconds`
- `musicOnHold`
- `overflowTargetType`
- `overflowTargetId`

Invariants:

- Queue timing values must stay within bounded operational ranges
- Overflow target type and ID must be set or cleared together
- Queue runtime actions must include queue behavior, not only member extensions

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

### 8.4 Recording

Represents recorded call or voicemail media metadata. The media itself may live in
filesystem or object storage; the domain object stores only a controlled reference.

Key fields:

- `id`
- `tenantId`
- `callId`
- `callEventId`
- `storageReference`
- `durationSeconds`
- `sizeBytes`
- `status`
- `recordedAt`
- `createdAt`

### 8.5 RecordingAnalysisRequest

Represents a provider-neutral request to transcribe or summarize a recording. The
request is part of the core domain contract even if the processor is an external
plugin or future AI service.

Key fields:

- `id`
- `tenantId`
- `recordingId`
- `requestedOutputs`
- `languageHint`
- `status`
- `transcriptText`
- `summaryText`
- `errorMessage`
- `providerMetadata`
- `createdAt`
- `completedAt`

Statuses:

- `queued`
- `processing`
- `completed`
- `failed`
- `cancelled`

Invariants:

- Analysis requests must stay scoped to the same tenant as the parent recording.
- Public APIs must not expose raw media storage paths or provider secrets.
- Transcript and summary values are nullable until processing completes.

### 8.6 LiveOperationalSnapshot

Represents a short-lived, derived view of current operational state for live UI
streams. It is not the canonical source of truth; it is assembled from runtime
sessions, call events, queue state, runtime health, webhook delivery state, and
adapter work queues.

Key fields:

- `tenantId`
- `activeCallCount`
- `activeIvrSessionCount`
- `queueDepths`
- `runtimeServices`
- `recentFailures`
- `webhookBacklog`
- `adapterBacklog`
- `generatedAt`

Invariants:

- Snapshots must be tenant-scoped unless served to a platform operator aggregate view.
- Snapshots must not expose raw FreeSWITCH payloads, provider secrets, or raw provider webhook bodies.
- Historical reporting should use durable records, not transient live snapshots.

## 9. Provider and Channel Integration Entities

### 9.1 PromptGenerationRequest

Represents a provider-neutral request to generate prompt media from text or SSML-like
input. A provider such as a text-to-speech service may fulfill it later, but the
domain contract stays independent of that provider.

Key fields:

- `id`
- `tenantId`
- `promptAssetId`
- `requestedOutputs`
- `inputText`
- `languageHint`
- `voiceHint`
- `providerHint`
- `status`
- `generatedPromptAssetId`
- `errorMessage`
- `providerMetadata`
- `createdAt`
- `completedAt`

Statuses:

- `queued`
- `processing`
- `completed`
- `failed`
- `cancelled`

Invariants:

- Generated prompt assets must stay tenant-scoped to the request tenant.
- Provider hints are optional routing preferences, not required business state.
- Public responses must not expose provider credentials or temporary media URLs.

### 9.2 IvrAiTurnRequest

Represents a bounded AI-assisted turn in an IVR runtime session. It lets a flow
delegate a customer question or request to an external AI adapter without giving
the provider direct control over call execution.

Key fields:

- `id`
- `tenantId`
- `runtimeSessionId`
- `callId`
- `flowId`
- `nodeId`
- `inputMode`
- `inputText`
- `requestedOutputs`
- `providerHint`
- `status`
- `answerText`
- `nextAction`
- `confidence`
- `errorMessage`
- `providerMetadata`
- `createdAt`
- `completedAt`

Statuses:

- `queued`
- `processing`
- `completed`
- `failed`
- `cancelled`

Invariants:

- The result may suggest a bounded next action, but core IVR execution remains in
  the backend runtime resolver.
- Provider output must be validated before it can route, transfer, or mutate state.
- Failed or timed-out turns must fall back to configured flow behavior.

### 9.3 ChannelAccount

Represents a tenant-owned account or integration endpoint for an external channel
such as WhatsApp, Telegram, Google Meet, or a custom adapter.

Key fields:

- `id`
- `tenantId`
- `provider`
- `displayName`
- `status`
- `capabilities`
- `externalAccountRef`
- `credentialRef`
- `createdAt`
- `updatedAt`

Capabilities:

- `message_inbound`
- `message_outbound`
- `voice_message`
- `native_call`
- `meeting`
- `sip_bridge`
- `transcript_artifacts`
- `recording_artifacts`

Invariants:

- Credentials are referenced only by secret handle and are never returned publicly.
- Features must be gated by declared capability instead of provider name alone.
- The account describes an external adapter integration; provider SDKs and delivery
  workers are not part of the control-plane API.

### 9.4 ChannelMessage

Represents an inbound or outbound message normalized across channel providers.

Key fields:

- `id`
- `tenantId`
- `channelAccountId`
- `provider`
- `direction`
- `messageKind`
- `externalConversationRef`
- `externalMessageRef`
- `fromRef`
- `toRef`
- `text`
- `mediaRefs`
- `status`
- `providerMetadata`
- `createdAt`
- `deliveredAt`

Directions:

- `inbound`
- `outbound`

Message kinds:

- `text`
- `voice`
- `audio`
- `image`
- `file`
- `interactive`

Invariants:

- Raw provider event bodies are not the canonical message model.
- Media references must be controlled storage or provider artifact references, not
  unbounded public URLs.
- Outbound messages are first stored as provider-neutral work. External adapter
  services claim the work, deliver it, and report sent or failed results.

### 9.5 ChannelVoiceSession

Represents a provider-backed voice, voice-message, meeting, or SIP-bridge
interaction related to a channel account.

Key fields:

- `id`
- `tenantId`
- `channelAccountId`
- `provider`
- `capability`
- `externalSessionRef`
- `callId`
- `meetingUrl`
- `status`
- `startedAt`
- `endedAt`
- `providerMetadata`
- `createdAt`

Invariants:

- A session capability must be declared on the parent channel account.
- Meeting or native-call sessions must not imply FreeSWITCH call control unless
  explicitly bridged through a supported SIP or runtime adapter.

## 9.6 Production Readiness Evidence Entities

These entities may be persisted, generated as release artifacts, or represented
as structured documents. They are part of the production-readiness domain even
when not stored in application tables.

### ReleaseCandidate

Represents a proposed production release.

Key fields:

- `version`
- `gitSha`
- `createdAt`
- `status`
- `evidenceRefs`
- `goNoGoDecision`
- `rollbackPlanRef`

Invariants:

- A production release candidate cannot be approved without required evidence.
- Release evidence must reference immutable artifacts or committed docs.

### RuntimeE2EEvidence

Represents proof that the real runtime loop worked for a candidate.

Required evidence:

- directory lookup
- dialplan lookup
- SIP registration or documented equivalent
- IVR runtime callback
- Go agent event ingestion
- observability timeline query
- rollback verification
- sanitized runtime logs

### DeploymentPreflightResult

Represents proof that a production-like deployment satisfies required config and
network assumptions.

Required evidence:

- production secrets are set and not defaults
- runtime endpoints are private or allowlisted
- PostgreSQL and ESL are not publicly exposed
- health/readiness pass
- FreeSWITCH reachability is verified

### RestoreSmokeResult

Represents proof that backup and restore preserve desired state and media
references.

Required evidence:

- migrations applied
- tenant desired state restored
- active published versions restored
- routes and prompts restored
- media references validated or orphaned references reported

### SoakTestResult

Represents load or soak evidence for production-critical paths.

Required evidence:

- runtime lookup latency
- call-event ingestion lag
- timeline query behavior
- webhook retry/DLQ behavior
- observability summary freshness
- redaction verification under load

### ComplianceEvidence

Represents tenant-isolation, audit, export, privacy, and support-bundle evidence.

Required evidence:

- cross-tenant denial matrix
- platform-admin audit behavior
- export tenant boundary
- support-bundle redaction
- recording/voicemail/CDR retention behavior where implemented

## 10. Relationship Summary

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
  -> Recording
  -> RecordingAnalysisRequest
  -> PromptGenerationRequest
  -> IvrAiTurnRequest
  -> ChannelAccount
  -> ChannelMessage
  -> ChannelVoiceSession
  -> ComplianceEvidence

IVRFlow
  -> FlowVersion

InboundRoute / OutboundRoute
  -> RouteVersion

FlowVersion / RouteVersion
  -> ValidationResult
  -> SimulationResult
  -> PublishRecord
  -> ApprovalRequest

ChannelAccount
  -> ChannelMessage
  -> ChannelVoiceSession

Recording
  -> RecordingAnalysisRequest

ReleaseCandidate
  -> RuntimeE2EEvidence
  -> DeploymentPreflightResult
  -> RestoreSmokeResult
  -> SoakTestResult
  -> ComplianceEvidence
```

## 11. Lifecycle Rules

### 11.1 Publishable Object Lifecycle

Suggested lifecycle:

1. Draft created
2. Draft edited
3. Validation executed
4. Simulation executed where applicable
5. Approval requested if required
6. Version published
7. Prior version remains rollback-capable

### 11.2 State Transition Rules

- A `draft` version may transition to `validated` only if validation passes
- A `validated` version may transition to `published` directly or after simulation and approval depending on policy
- A `published` version may transition to `superseded` when replaced by a newer active version
- A prior `published` or `superseded` version may become active again through rollback

### 11.3 Provider Work Request Lifecycle

Suggested lifecycle:

1. Request created as `queued`
2. Trusted adapter claims request as `processing`
3. Adapter completes with bounded result or failure
4. Completed result remains readable through business APIs
5. Failed request remains auditable and may be retried by policy

## 12. Domain Invariants

- There is exactly one canonical desired-state owner for each configuration object
- Active versions are explicit, never implicit
- Publish actions are auditable and attributable
- AI-facing operations must remain within the constrained business vocabulary
- Runtime artifacts are derived outputs, not canonical domain entities
- Live observability snapshots are derived views, not canonical domain entities
- External provider outputs are inputs to domain workflows, not direct authority
- Provider capabilities must be explicit before channel-specific actions are accepted
- Production release candidates require evidence artifacts before production tagging
- Evidence artifacts must not contain secrets, raw SIP credentials, runtime tokens,
  JWTs, webhook secrets, raw provider payloads, or raw recording media

## 13. Mapping Guidance

### 13.1 API Mapping

- Public endpoints should expose these domain nouns directly
- Public payloads should avoid leaking FreeSWITCH-specific implementation details unless operationally necessary
- Provider-specific payloads should be represented as bounded metadata, not as the
  primary public contract

### 13.2 Database Mapping

- Tables may be normalized differently from the conceptual model, but ownership and invariants must remain intact
- Versioned object content may be stored in structured relational or document-like form as long as validation and auditability remain strong

### 13.3 UI Mapping

- UI terminology should mirror domain terms such as flow, route, prompt, validation, simulation, publish, and rollback

## 14. Open Modeling Questions

- Final queue, ring group, and agent abstractions if call-center features are added
- Whether routes share one generic versioning model or distinct inbound and outbound version types
- Final approval policy attachment model
- Exact representation of IVR node graphs and simulation scenarios
- Final provider adapter installation and credential storage model
- Exact channel capability matrix by provider and deployment environment
