# manageCallAI Database Schema

## 1. Purpose

This document defines the initial PostgreSQL schema direction for `manageCallAI`.

It maps the conceptual domain model into relational structures suitable for MVP implementation while preserving versioning, auditability, and clear ownership of desired state.

## 2. Design Principles

- PostgreSQL is the canonical store for desired state
- Runtime artifacts are derived outputs, not primary records of business intent
- Publishable objects use explicit version tables
- Mutable operational state and immutable audit history are separated
- JSONB is allowed for flexible definitions and result payloads, but core ownership and lookup fields remain relational

## 3. Schema Areas

### 3.1 Identity and Access

- `tenants`
- `users`
- `policies`

### 3.2 Core Telecom Configuration

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

### 3.3 Versioned Lifecycle Data

- `flow_versions`
- `route_versions`
- `validation_results`
- `simulation_results`
- `approval_requests`
- `publish_records`

### 3.4 Observability and Audit

- `audit_events`
- `call_detail_records`
- `call_events`
- `runtime_ingestion_records`
- `tenant_audit_log`
- `security_alert_rules`
- `security_alerts`
- `security_alert_cooldowns`

### 3.5 Runtime, Compliance, and Integration Operations

- `ivr_flow_sessions`
- `ivr_flow_session_steps`
- `idempotency_records`
- `webhook_delivery_log`
- `webhook_delivery_queue`
- `freeswitch_nodes`
- `freeswitch_node_tokens`
- `tenant_retention_policies`
- `legal_hold_requests`
- `recordings`
- `recording_analysis_requests`
- `voicemail_messages`
- `provider_work_requests`
- `channel_accounts`
- `channel_messages`
- `meeting_sessions`
- `tenant_outbound_policies`

## 4. Table Intent

### 4.1 tenants

Owns the tenant boundary. MVP may operate with a single tenant, but schema design should remain tenant-aware.

### 4.2 users and policies

`users.role` is the canonical persisted tenant role source. Supported persisted
tenant roles are `tenant_admin`, `tenant_operator`, and `tenant_viewer`; the
`platform_admin` role is computed at login from `PLATFORM_OPERATOR_EMAILS` and
issued in the JWT rather than stored for normal tenant users.

The legacy `roles`, `user_roles`, and `role_policies` tables from the initial
schema are removed by `0042_drop_legacy_role_tables.sql`. New authorization work
must extend the explicit capability model rather than reusing those table names.

`policies` stores tenant-level governance rules such as approval requirements.
It is not a role-assignment table.

### 4.3 extensions

Stores internal callable identities and their default destinations.

Secret-handling for SIP credentials:

- `sip_username` — stored in plaintext; used as the SIP registration username.
- `sip_password_ciphertext` — AES-256-GCM ciphertext; format `base64(iv).base64(authTag).base64(ciphertext)`.
- `sip_password_key_id` — identifies the symmetric key used; enables key rotation without re-encrypting in SQL.
- The API accepts plaintext `sip_password` on create/update and encrypts before storage.
- The API never returns plaintext or ciphertext to HTTP clients.
- The FreeSWITCH directory endpoint decrypts only at XML generation time.
- Future direction: replace the symmetric key with an external secret store (e.g. Vault, AWS Secrets Manager).

### 4.4 sip_trunks

Stores trunk definitions and metadata.

Secret-handling rule:

- Never store raw SIP trunk passwords directly in normal JSONB long-term.
- Use encrypted columns initially.
- Migrate to an external secret provider later.

Practical design direction:

- Use explicit non-secret metadata columns:
  - `name`
  - `direction`
  - `realm`
  - `proxy`
  - `port`
  - `transport`
  - `username`
  - `auth_username`
  - `dtmf_mode`
  - `codec_prefs`
  - `srtp_policy`
- Store secret material in dedicated encrypted columns:
  - `auth_password_ciphertext`
  - `auth_password_key_id`
- The API accepts plaintext `auth_password` on create/update and encrypts it before persistence.
- The API never returns plaintext, ciphertext, or key-id fields in normal trunk responses.
- Treat external secret-provider integration as the long-term target rather than the initial blocker.

### 4.5 phone_numbers

Stores DIDs and their assigned targets.

`phone_numbers` also provide the canonical DID inventory for inbound route binding.
When an inbound route links `phone_number_id`, the application normalizes the route
`match_value` from the referenced `e164_number` so business routing stays aligned
with number inventory.

### 4.6 prompt_assets

Stores metadata for IVR prompt media.

Practical runtime fields:

- `name` - tenant-scoped stable human label
- `media_type` - expected media MIME type such as `audio/wav`
- `language` - optional locale hint
- `storage_uri` - runtime-resolvable media path or URI used by the IVR resolver
- `checksum` - optional integrity marker for deployment/media sync
- `status` - active/inactive lifecycle gate

### 4.7 queues, queue_members

Store tenant-scoped ring targets without exposing raw FreeSWITCH queue internals.

Practical fields:

- `queues.name`
- `queues.strategy` - currently `simultaneous` or `sequential`
- `queues.ring_timeout_seconds`
- `queues.status`
- `queue_members.extension_id`
- `queue_members.position`

The desired-state queue resource remains business-level. Runtime translation into
bridge strings or later queue applications happens in backend/runtime adapters,
not through public raw dialplan editing.

### 4.8 voicemail_boxes

Store tenant-scoped voicemail destinations and greeting references.

Practical fields:

- `name`
- `mailbox_number`
- `greeting_prompt_id`
- `status`

The box stores business ownership and prompt linkage. FreeSWITCH execution still
occurs through constrained runtime/dialplan projection rather than raw user-authored
switch internals.

### 4.9 ivr_flows and flow_versions

`ivr_flows` stores the durable business object identity and current pointers.

`flow_versions` stores versioned flow definitions and lifecycle timestamps.

### 4.10 inbound_routes, outbound_routes, route_versions

Route tables store the durable route identity and active or draft pointers.

`route_versions` stores versioned definitions for both inbound and outbound route types.

`inbound_routes.phone_number_id` is optional and is used for DID-backed routes that
should bind to a real tenant phone number instead of relying on free-form text only.

`inbound_routes.target_type` now also supports `queue` and `voicemail_box` in
addition to the earlier `flow`, `extension`, and `call_group` targets.

### 4.11 validation_results and simulation_results

Store execution outcomes for validation and simulation by object and version.

### 4.12 approval_requests and publish_records

Represent change governance and publish or rollback history.

### 4.13 audit_events

Stores actor-attributed, immutable operational audit history.

### 4.14 call_detail_records, call_events, runtime_ingestion_records

Store normalized runtime and ingestion visibility from FreeSWITCH integration paths.

### 4.15 ivr_flow_sessions

Stores per-call runtime execution state for the backend IVR resolver.

Core intent:

- pin the published `flow_version_id` used for the call
- correlate `call_id`, `tenant_id`, and `flow_id`
- track the current actionable node awaiting a runtime result
- persist `last_digits` and runtime variables between steps
- keep the last emitted constrained action for debugging and recovery

This table is operational state, not desired state. It should be treated as
ephemeral runtime coordination data, while `ivr_flows` and `flow_versions`
remain the source of truth for behavior design.

### 4.16 ivr_flow_session_steps

Stores the durable per-step execution trace for an IVR runtime session.

Core intent:

- preserve the operator-visible replay path for each call session
- record the phase (`start` or `advance`) and reported outcome
- retain the next emitted constrained action for debugging
- keep replay inside backend-owned abstractions instead of forcing raw FreeSWITCH inspection

This table complements `ivr_flow_sessions`:

- `ivr_flow_sessions` = current pinned runtime state
- `ivr_flow_session_steps` = append-only replay history for that session

### 4.17 idempotency_records

Stores request fingerprints and response metadata for retry-safe automation and
AI/tool calls that supply an `Idempotency-Key`. It applies to mutation routes
where repeat delivery is expected.

### 4.18 webhook_delivery_log and webhook_delivery_queue

Store durable webhook delivery attempts, event IDs, retry/DLQ state, HMAC
signature metadata, and delivery lifecycle timestamps. They support safe
workflow retry without exposing raw runtime control.

### 4.19 freeswitch_nodes and freeswitch_node_tokens

Store platform-owned runtime node registry and hashed node credentials. Runtime
node secrets are write-only: raw values are returned once on create/rotation and
are never exposed in normal reads.

### 4.20 tenant_retention_policies and legal_hold_requests

Store per-tenant retention overrides and legal holds. Retention covers
recordings, voicemail, transcripts, AI summaries, CDRs, call events, generated
media, and webhook delivery records. Legal holds prevent purge for matching
tenant/resource scope until released.

### 4.21 security_alert_rules, security_alerts, security_alert_cooldowns

Store tenant-scoped and platform-visible alert rules, alert instances, and
cooldown state for abuse and runtime health signals.

### 4.22 tenant_outbound_policies

Stores tenant-level outbound fraud policy, including country/area-code
allowlists, high-risk blocks, and attempt/call caps. Runtime outbound dispatch
must enforce global blocks, tenant policy, and route policy before queuing work.

## 5. Versioning Strategy

- `ivr_flows`, `inbound_routes`, and `outbound_routes` each store `draft_version_id` and `active_version_id`
- Version tables store immutable snapshots
- Publish activates an existing version rather than mutating it in place
- Rollback moves the active pointer to a previous eligible version and records a publish record

## 6. Suggested SQL Conventions

- Use `uuid` primary keys with `gen_random_uuid()`
- Use `timestamptz` for operational timestamps
- Use `jsonb` for flexible definitions, rules, metadata, validation details, and simulation payloads
- Prefer unique indexes for business identifiers within tenant scope
- Use check constraints for bounded status fields in MVP
- Do not treat normal JSONB columns as the long-term storage location for raw telecom credentials

## 7. Key Integrity Rules

- Tenant-scoped business identifiers must be unique where required
- A flow or route may have at most one active version pointer
- Published versions must remain immutable
- Audit and publish records must remain append-only
- Route and flow version records must not be reused across object identities
- Raw SIP trunk passwords must not live long-term in general-purpose JSONB fields
- Runtime node tokens, webhook secrets, and provider credentials must be stored
  as hashed/encrypted/secret references and omitted from public responses
- Retention purge must honor legal hold before deleting any record

## 8. Important Tradeoffs

- `jsonb` allows rapid iteration for flow definitions and policy rules, but too much unstructured data would weaken queryability
- A shared `route_versions` table keeps route versioning consistent, but increases conditional logic compared with separate inbound and outbound version tables
- Storing actor IDs as nullable references where actors may be user, workflow, or system is pragmatic for MVP, but may be refined later into a more formal principal model
- Encrypted trunk-secret columns are a pragmatic first step, but an external secret provider should replace them when operational maturity requires stronger secret lifecycle management

## 9. Initial Migration Scope

The initial migration should create:

- Core identity tables
- Core telecom configuration tables
- Flow and route versioning tables
- Validation, simulation, approval, publish, and audit tables
- Runtime observation tables
- Basic indexes and unique constraints

## 10. Migration Layout

- `db/migrations/0001_initial_schema.sql` is the canonical schema baseline
- Future database changes should be added as new ordered migration files
- `db/README.md` documents the migration directory conventions

## 11. Related Files

- [../api/openapi.yaml](../api/openapi.yaml)
- [domain-model.md](domain-model.md)
- [../../db/README.md](../../db/README.md)
- [../../db/migrations/0001_initial_schema.sql](../../db/migrations/0001_initial_schema.sql)
