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
- `roles`
- `user_roles`
- `policies`
- `role_policies`

### 3.2 Core Telecom Configuration

- `extensions`
- `sip_trunks`
- `phone_numbers`
- `prompt_assets`
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

## 4. Table Intent

### 4.1 tenants

Owns the tenant boundary. MVP may operate with a single tenant, but schema design should remain tenant-aware.

### 4.2 users, roles, user_roles, policies, role_policies

Support authentication-related identity mapping and authorization policy assignment.

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
- Store secret material in dedicated encrypted columns:
  - `auth_password_ciphertext`
  - `auth_password_key_id`
- The API accepts plaintext `auth_password` on create/update and encrypts it before persistence.
- The API never returns plaintext, ciphertext, or key-id fields in normal trunk responses.
- Treat external secret-provider integration as the long-term target rather than the initial blocker.

### 4.5 phone_numbers

Stores DIDs and their assigned targets.

### 4.6 prompt_assets

Stores metadata for IVR prompt media.

### 4.7 ivr_flows and flow_versions

`ivr_flows` stores the durable business object identity and current pointers.

`flow_versions` stores versioned flow definitions and lifecycle timestamps.

### 4.8 inbound_routes, outbound_routes, route_versions

Route tables store the durable route identity and active or draft pointers.

`route_versions` stores versioned definitions for both inbound and outbound route types.

### 4.9 validation_results and simulation_results

Store execution outcomes for validation and simulation by object and version.

### 4.10 approval_requests and publish_records

Represent change governance and publish or rollback history.

### 4.11 audit_events

Stores actor-attributed, immutable operational audit history.

### 4.12 call_detail_records, call_events, runtime_ingestion_records

Store normalized runtime and ingestion visibility from FreeSWITCH integration paths.

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
