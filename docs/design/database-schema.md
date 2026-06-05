# manageCallAI Database Schema

## 1. Purpose

This document defines the PostgreSQL schema direction implemented by `manageCallAI`.

It maps the conceptual domain model into relational structures while preserving tenant scoping, auditability, lifecycle control, and clear ownership of desired state.

## 2. Design principles

- PostgreSQL is the canonical store for desired state
- runtime artifacts are derived outputs, not primary records of business intent
- publishable objects use explicit version tables
- mutable operational state and immutable audit history are separated
- JSONB is allowed for flexible definitions and result payloads, but core ownership and lookup fields stay relational

## 3. Schema areas

### 3.1 Identity and access

- `tenants`
- `users`
- `policies`

### 3.2 Core telecom configuration

- `extensions`
- `sip_trunks`
- `phone_numbers`
- `prompt_assets`
- `queues`
- `queue_members`
- `voicemail_boxes`
- `ivr_flows`
- `inbound_routes`
- `outbound_routes`
- `feature_codes`
- `parking_lots`
- `conference_rooms`
- `end_user_self_service_policies`

### 3.3 Versioned lifecycle data

- `flow_versions`
- `route_versions`
- `validation_results`
- `simulation_results`
- `approval_requests`
- `publish_records`

### 3.4 Observability and audit

- `audit_events`
- `call_detail_records`
- `call_events`
- `runtime_ingestion_records`
- `recordings`
- `voicemail_messages`
- `parked_calls`
- `conference_participant_snapshots`
- `freeswitch_nodes`
- `freeswitch_node_status_snapshots`
- `security_alert_rules`
- `security_alerts`
- `security_alert_cooldowns`

### 3.5 Runtime, bootstrap, and integration operations

- `ivr_flow_sessions`
- `ivr_flow_session_steps`
- `idempotency_records`
- `webhook_delivery_log`
- `webhook_delivery_queue`
- `runtime_apply_requests`
- `provider_work_requests`
- `channel_accounts`
- `channel_messages`
- `meeting_sessions`
- `tenant_outbound_policies`
- `tenant_retention_policies`
- `legal_hold_requests`
- `system_config`
- `tenant_ai_policy_overrides`

## 4. Table intent

### 4.1 `users`

`users.role` is the canonical persisted tenant role source. The current code line supports persisted tenant roles `tenant_admin`, `tenant_operator`, `tenant_viewer`, and `end_user`. `platform_admin` is computed from `PLATFORM_OPERATOR_EMAILS` and issued in JWTs rather than stored as a normal tenant role.

### 4.2 `extensions`

Stores internal callable identities and their default destinations.

Secret-handling for SIP credentials:

- `sip_username` is stored in plaintext for runtime lookup
- `sip_password_ciphertext` stores AES-256-GCM ciphertext
- `sip_password_key_id` identifies the encryption key

Current self-service additions:

- `dnd_enabled boolean not null default false`
- `call_forward_enabled boolean not null default false`
- `call_forward_target text`
- `owner_user_id uuid references users(id) on delete set null`

### 4.3 `sip_trunks`

Stores trunk definitions and metadata. Secret material is stored in dedicated encrypted columns rather than normal public payload fields.

### 4.4 `phone_numbers`

Stores DIDs and their assigned targets.

### 4.5 `prompt_assets`

Stores prompt metadata including name, media type, language, storage URI, checksum, and status.

### 4.6 `queues` and `queue_members`

Store tenant-scoped ring targets and queue membership without exposing raw FreeSWITCH queue internals.

### 4.7 `voicemail_boxes`

Store tenant-scoped voicemail destinations and greeting references.

### 4.8 `ivr_flows` and `flow_versions`

Store durable IVR flow identity and immutable version snapshots.

### 4.9 `inbound_routes`, `outbound_routes`, and `route_versions`

Store durable route identity and immutable version snapshots.

### 4.10 `audit_events`

Stores actor-attributed immutable operational audit history.

### 4.11 `call_detail_records`, `call_events`, and `runtime_ingestion_records`

Store normalized runtime and ingestion visibility from FreeSWITCH integration paths.

### 4.12 `ivr_flow_sessions` and `ivr_flow_session_steps`

Store runtime execution state and append-only replay history for backend-owned IVR session handling.

### 4.13 `idempotency_records`

Store request fingerprints and response metadata for retry-safe automation and AI/tool calls.

### 4.14 `webhook_delivery_log` and `webhook_delivery_queue`

Store durable webhook delivery attempts, retry state, and delivery lifecycle timestamps.

### 4.15 `freeswitch_nodes`

Stores platform-owned runtime node registry and hashed node credentials.

### 4.16 `runtime_apply_requests`

Stores bounded requests for runtime apply/reload work targeted at a specific FreeSWITCH node after a desired-state change.

Current implementation:

- introduced by `0045_runtime_apply_requests.sql`
- indexed by target node, tenant, and source object

### 4.17 `feature_codes`

Stores tenant-scoped DTMF feature code definitions.

Current implementation:

- introduced by `0046_feature_codes.sql`
- supports actions including DND, call-forward enable/disable, parking, and conference join

### 4.18 `parking_lots` and `parked_calls`

Store tenant-defined call parking configuration and operational parked-call state.

Current implementation:

- introduced by `0047_parking.sql`
- `parking_lots` holds slot range configuration
- `parked_calls` holds operational slot occupancy and retrieval/timeout state

### 4.19 `conference_rooms` and `conference_participant_snapshots`

Store conference-room desired state and normalized runtime participant observations.

Current implementation:

- introduced by `0048_conference_rooms.sql`
- `conference_rooms.pin_ciphertext` stores encrypted PIN material

### 4.20 `freeswitch_node_status_snapshots`

Stores runtime status snapshots posted by the Go agent for platform and tenant operational visibility.

Current implementation:

- introduced by `0049_node_status_snapshots.sql`
- includes module, gateway, channel, registration, and missing-module summaries

### 4.21 `end_user_self_service_policies`

Stores per-tenant self-service permissions for `end_user` actors.

Current implementation:

- introduced by `0050_self_service.sql`

### 4.22 `tenant_outbound_policies`

Stores tenant-level outbound fraud policy including allowlists, blocks, and attempt/call caps.

### 4.23 `tenant_retention_policies` and `legal_hold_requests`

Store per-tenant retention overrides and legal holds.

### 4.24 `system_config`

Stores platform-level configuration sentinels and other singleton settings.

Current implementation:

- introduced by `0052_system_config.sql`
- currently used for `setup_complete`
- now also stores serialized `ai_platform_policy`
- gates whether `/setup` is registered at API startup

### 4.25 `tenant_ai_policy_overrides`

Stores tenant-scoped opt-in and preferred-provider overrides for provider-backed
AI features.

Current implementation:

- introduced by `0055_ai_provider_policy.sql`
- platform policy remains authoritative; tenant rows only narrow or opt in
- current feature columns cover `prompt_generation` and `ivr_ai_turn`

## 5. Versioning strategy

- `ivr_flows`, `inbound_routes`, and `outbound_routes` store `draft_version_id` and `active_version_id`
- version tables store immutable snapshots
- publish activates an existing version rather than mutating it in place
- rollback moves the active pointer to a previous eligible version and records a publish record

## 6. Integrity rules

- tenant-scoped business identifiers must be unique where required
- published versions remain immutable
- audit and publish records remain append-only
- route and flow version records are not reused across object identities
- raw SIP trunk passwords do not live in general-purpose JSONB fields
- runtime node tokens, webhook secrets, and provider credentials are stored as hashed, encrypted, or indirect secret references and omitted from public responses
