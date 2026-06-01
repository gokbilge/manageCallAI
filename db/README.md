# Database Migrations

This directory contains the PostgreSQL schema baseline and all incremental migrations for `manageCallAI`.

## Layout

```
db/
├── migrate.mjs          Migration runner (apply / status / check)
├── README.md            This file — governance rules and migration catalogue
└── migrations/          Ordered SQL files applied in lexical order
    ├── 0001_*.sql       …
    └── NNNN_*.sql
```

---

## Governance Rules

These rules are enforced by CI.  Violations block merge.

### Naming

Every file in `db/migrations/` **must** match the pattern:

```
NNNN_<slug>.sql
```

- `NNNN` is a zero-padded four-digit integer (e.g. `0038`).
- `<slug>` is lower-snake-case, descriptive of the change.
- No spaces, no uppercase.

Validated by `pnpm check:migrations` (runs before migration replay in CI).

### Ordering

Numeric prefixes must form a contiguous sequence starting at `0001`.
Gaps are not allowed unless they correspond to a documented noop shim (see below).

### Immutability

**Never edit a migration file after it has been applied to any non-ephemeral database.**
The `schema_migrations` table records filename + hash.  Editing a file creates an
`applied-missing` / hash-mismatch situation that must be resolved manually.

If you discover a mistake in a recently added migration:

1. If it has **not** been applied anywhere: edit it and update this README.
2. If it **has** been applied to staging or production: write a *new* migration to correct it.

### Adding a migration

```sh
# Pick the next number
ls db/migrations/ | sort | tail -1   # e.g. 0037_sip_trunk_srtp_policy.sql → next is 0038

# Create the file
touch db/migrations/0038_my_change.sql
# Write the SQL
# Add a row to the table below in this file
# Run locally: pnpm db:migrate && pnpm db:contracts && pnpm db:constraints
```

Acceptance checklist before opening a PR:

- [ ] Filename matches `NNNN_slug.sql`.
- [ ] All statements are idempotent (`IF NOT EXISTS`, `IF EXISTS`, `OR REPLACE`).
- [ ] The file is described in the table below.
- [ ] `pnpm check:migrations` passes.
- [ ] `pnpm db:migrate` applies cleanly from scratch (fresh DB replay).
- [ ] `pnpm db:contracts` passes.
- [ ] `pnpm db:constraints` passes.
- [ ] `docs/design/database-schema.md` is updated if tables/columns changed.

### Noop shims — documented duplicate prefixes

Occasionally a migration file is renamed after being applied in production.  The
original filename must be retained as an empty **noop shim** so that databases
which already have it in `schema_migrations` do not show spurious `applied-missing`
warnings.

Every noop shim pair **must** be documented in:

1. The table below (in this file).
2. `scripts/check-migration-order.mjs` → `NOOP_SHIM_PAIRS` array.

Undocumented duplicate prefixes cause `pnpm check:migrations` to fail CI.

| Prefix | Noop shim file | Canonical file (has SQL) | Real DDL is in | Reason |
|--------|----------------|--------------------------|----------------|--------|
| `0005` | `0005_relax_inbound_route_match_uniqueness.sql` | `0005_explicit_sip_trunk_fields.sql` | `0007_relax_inbound_route_match_uniqueness.sql` | Filename applied before renaming; partial-index DDL moved to 0007. |
| `0015` | `0015_outbound_routes.sql` | `0015_add_ivr_flow_session_steps.sql` | `0021_outbound_routes.sql` | Outbound-routes DDL renumbered to avoid collision with session-steps. |
| `0016` | `0016_outbound_call_requests.sql` | `0016_add_queues_and_voicemail.sql` | `0022_outbound_call_requests.sql` | Outbound-call-requests DDL renumbered for same reason. |

---

## Running Migrations

```sh
# 1. Start PostgreSQL (local Docker)
pnpm db:up

# 2. Apply all pending migrations
pnpm db:migrate

# 3. Verify columns expected by the application exist
pnpm db:contracts

# 4. Verify constraints, defaults, indexes, and immutability rules
pnpm db:constraints

# 5. Check migration naming and ordering
pnpm check:migrations

# 6. Show which migrations have / have not been applied
pnpm db:status
```

The runner applies files in **lexical order** and records filenames in the
`schema_migrations` table.  Noop shims are applied (recording their filename)
but perform no schema changes.

---

## CI Gates

After migrations and before tests, CI runs:

| Step | Command | What it checks |
|------|---------|----------------|
| Migration order and naming | `pnpm check:migrations` | Filename format, numeric ordering, documented shim pairs |
| Migration replay | `pnpm db:migrate` | All SQL is syntactically valid; migrations apply cleanly |
| Column presence | `pnpm db:contracts` | Application-required columns exist after migrations |
| Constraint check | `pnpm db:constraints` | Column defaults, CHECK constraints, UNIQUE indexes, immutability rules, FK presence |

All four gates must pass.  A failure in any gate blocks the merge.

---

## Migration Catalogue

| File | What it adds |
|------|-------------|
| `0001_initial_schema.sql` | Core tables: `tenants`, `users`, legacy `roles` / `user_roles`, `policies`, `extensions`, `sip_trunks`, `phone_numbers`, `inbound_routes`. Includes `tenants.directory_domain` and per-extension SIP credential columns (squashed from earlier drafts). |
| `0002_add_user_password.sql` | `users.password_hash` |
| `0003_noop.sql` | Standalone noop — documents a squash that folded columns into `0001`. No duplicate prefix. |
| `0004_encrypt_sip_passwords.sql` | Backfills `extensions.sip_password_ciphertext` / `sip_password_key_id` |
| `0005_explicit_sip_trunk_fields.sql` | SIP trunk explicit column migration (canonical `0005` file). |
| `0005_relax_inbound_route_match_uniqueness.sql` | **Noop shim** — actual DDL is in `0007`. See shim table above. |
| `0006_add_sip_trunk_network_fields.sql` | SIP trunk network fields. |
| `0007_relax_inbound_route_match_uniqueness.sql` | Replaces schema-level unique constraint on `inbound_routes` with a partial unique index (`WHERE status = 'active'`). |
| `0008_add_phone_number_id_to_inbound_routes.sql` | FK from `inbound_routes` to `phone_numbers`. |
| `0009_add_ivr_flow_sessions.sql` | `ivr_flows`, `flow_versions`, `ivr_flow_sessions` tables. |
| `0010_add_call_groups.sql` | `call_groups`, `call_group_members` tables. |
| `0011_add_call_group_route_target.sql` | Call-group target type on inbound routes. |
| `0012_add_automation.sql` | `automation_api_keys`, `automation_webhooks` tables. |
| `0013_webhook_failure_tracking.sql` | Webhook failure tracking columns. |
| `0014_schedules.sql` | `schedules` table for business-hours rules. |
| `0015_add_ivr_flow_session_steps.sql` | `ivr_flow_session_steps` table (canonical `0015` file). |
| `0015_outbound_routes.sql` | **Noop shim** — actual DDL is in `0021`. See shim table above. |
| `0016_add_queues_and_voicemail.sql` | `queues`, `queue_members`, `voicemail_boxes` tables (canonical `0016` file). |
| `0016_outbound_call_requests.sql` | **Noop shim** — actual DDL is in `0022`. See shim table above. |
| `0017_webhook_delivery_log.sql` | `webhook_delivery_log` table. |
| `0018_user_roles.sql` | `users.role` NOT NULL with `DEFAULT 'tenant_admin'` and `users_role_check` CHECK constraint. |
| `0019_tenant_audit_log.sql` | `audit_events` and `tenant_audit_log` tables. |
| `0020_call_recordings.sql` | `recordings` table. |
| `0021_outbound_routes.sql` | `outbound_routes` table — renumbered from the original `0015_outbound_routes.sql`. |
| `0022_outbound_call_requests.sql` | `outbound_call_requests` table — renumbered from the original `0016_outbound_call_requests.sql`. |
| `0023_provider_work_and_webhook_queue.sql` | `prompt_generation_requests`, `ivr_ai_turn_requests`, `webhook_delivery_queue` tables. |
| `0024_outbound_call_status_expansion.sql` | Outbound call status enum expansion. |
| `0025_channel_accounts.sql` | `channel_accounts` table. |
| `0026_channel_adapter_work_loop.sql` | Channel adapter work-loop tables. |
| `0027_role_model_cleanup.sql` | Adds `platform_admin` to `users_role_check` as a DB-level safety net. |
| `0028_db_integrity_hardening.sql` | Hot-path indexes, immutability rules on `audit_events` / `tenant_audit_log`, active-route uniqueness index, webhook priority index. |
| `0029_api_key_capabilities.sql` | `automation_api_keys.capabilities text[]` — scoped API key permissions. |
| `0030_p1_runtime_safety.sql` | Runtime safety constraints for IVR sessions. |
| `0031_webhook_event_ids_and_dlq.sql` | `event_id` on `webhook_delivery_queue`; DLQ columns (`abandoned_at`, `dismissed_at`, `dismiss_reason`). |
| `0032_idempotency_records.sql` | `idempotency_records` table with `UNIQUE(tenant_id, idempotency_key)` for AI/automation mutation replay protection. |
| `0033_extension_event_log.sql` | Extension event log table. |
| `0034_dtmf_and_codec.sql` | DTMF and codec fields on extensions. |
| `0035_recording_lifecycle.sql` | Recording lifecycle status columns. |
| `0036_voicemail_messages.sql` | `voicemail_messages` table. |
| `0037_sip_trunk_srtp_policy.sql` | `sip_trunks.srtp_policy` column for SRTP enforcement policy. |
| `0038_tenant_retention_policies.sql` | Tenant retention policies and legal hold requests. |
| `0039_security_alerts.sql` | Tenant-scoped security alert rules and fired alert instances. |
| `0040_freeswitch_node_registry.sql` | FreeSWITCH node registry and runtime nonce replay protection. |
| `0041_tenant_outbound_policies.sql` | Tenant outbound fraud policy and global blocked destination prefixes. |
| `0042_drop_legacy_role_tables.sql` | Drops unused legacy `roles`, `user_roles`, and `role_policies` tables; `users.role` remains the canonical tenant role source. |
