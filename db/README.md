# Database Migrations

This directory contains the PostgreSQL schema baseline and future migrations for `manageCallAI`.

## Layout

- `migrations/`
  Ordered SQL migrations. These are the canonical database change history.

## Rules

- Add schema changes as new ordered migration files.
- Do not edit an already-applied migration in a real environment.
- Keep `docs/design/database-schema.md` aligned with the migration history.

## Current Baseline

The migration chain currently covers:

| File | What it adds |
|------|-------------|
| `0001_initial_schema.sql` | Core tables: `tenants`, `users`, `roles`, `user_roles`, `policies`, `extensions`, `sip_trunks`, `phone_numbers`, `inbound_routes`. Includes `tenants.directory_domain` and per-extension SIP credential columns (squashed from earlier drafts). |
| `0002_add_user_password.sql` | `users.password_hash` |
| `0003_noop.sql` | Intentionally empty — documents a squash that folded its columns into `0001`. |
| `0004_encrypt_sip_passwords.sql` | Backfills `extensions.sip_password_ciphertext` / `sip_password_key_id` |
| `0005_explicit_sip_trunk_fields.sql` | SIP trunk explicit column migration. Contains the full context for the `0005` pair — see shim note below. |
| `0005_relax_inbound_route_match_uniqueness.sql` | **noop shim** — actual change is in `0007`. Retained to preserve `schema_migrations` history. |
| `0006_add_sip_trunk_network_fields.sql` | SIP trunk network fields. |
| `0007_relax_inbound_route_match_uniqueness.sql` | Active inbound-route uniqueness: replaces schema constraint with partial unique index (`WHERE status = 'active'`). |
| `0008`–`0014` | Phone number FK, IVR sessions, call groups, automation API keys + webhooks, schedules. |
| `0015_add_ivr_flow_session_steps.sql` | `ivr_flow_session_steps` table. Contains the full context for the `0015` pair — see shim note below. |
| `0015_outbound_routes.sql` | **noop shim** — actual change is in `0021`. Retained to preserve `schema_migrations` history. |
| `0016_add_queues_and_voicemail.sql` | `queues`, `queue_members`, `voicemail_boxes` tables. Contains the full context for the `0016` pair — see shim note below. |
| `0016_outbound_call_requests.sql` | **noop shim** — actual change is in `0022`. Retained to preserve `schema_migrations` history. |
| `0017_webhook_delivery_log.sql` | Webhook delivery log table. |
| `0018_user_roles.sql` | **`users.role`** — adds the role column with a `CHECK` constraint (`tenant_admin`, `tenant_operator`, `tenant_viewer`). All existing users default to `tenant_admin`. |
| `0019_tenant_audit_log.sql` | `audit_events` table with `actor_type`, `actor_id`, `action`, `metadata`. |
| `0020_call_recordings.sql` | `recordings` table. |
| `0021_outbound_routes.sql` | `outbound_routes` table — renumbered from the original `0015_outbound_routes.sql` which became a noop shim. |
| `0022_outbound_call_requests.sql` | `outbound_call_requests` table — renumbered from the original `0016_outbound_call_requests.sql` which became a noop shim. |
| `0023_provider_work_and_webhook_queue.sql` | Provider work tables (`prompt_generation_requests`, `ivr_ai_turn_requests`) and persistent `webhook_delivery_queue`. |
| `0024`–`0026` | Outbound call status expansion, channel accounts, channel adapter work loop. |
| `0027_role_model_cleanup.sql` | Updates `users_role_check` to also accept `platform_admin` as a DB-level safety net (never written by normal flows; computed at login time). |
| `0028_db_integrity_hardening.sql` | FK constraints, NOT NULL enforcement, index additions. |
| `0029_api_key_capabilities.sql` | `automation_api_keys.capabilities text[]` — scoped API key permissions. |
| `0030_p1_runtime_safety.sql` | Runtime safety constraints for IVR sessions. |
| `0031_webhook_event_ids_and_dlq.sql` | `event_id` on `webhook_delivery_queue`; DLQ metadata columns. |
| `0032_idempotency_records.sql` | `idempotency_records` table for AI/automation mutation replay protection. |
| `0033`–`0036` | Extension event log, DTMF/codec fields, recording lifecycle, voicemail messages. |

### Noop shims (same-number pairs)

Three migration numbers have two files each. In every case the second file is a
**noop shim** — it contains no SQL, only a one-line comment. The shim exists
solely because the filename was already recorded in `schema_migrations` on some
databases when the content was renumbered; deleting it would surface
`applied-missing` warnings without fixing anything.

| Canonical file (has SQL) | Noop shim | Real SQL lives in |
|--------------------------|-----------|-------------------|
| `0005_explicit_sip_trunk_fields.sql` | `0005_relax_inbound_route_match_uniqueness.sql` | `0007_relax_inbound_route_match_uniqueness.sql` |
| `0015_add_ivr_flow_session_steps.sql` | `0015_outbound_routes.sql` | `0021_outbound_routes.sql` |
| `0016_add_queues_and_voicemail.sql` | `0016_outbound_call_requests.sql` | `0022_outbound_call_requests.sql` |

The canonical file for each pair carries a `-- Companion shim:` note in its
header so you can understand the pair without opening both files.

**Key note on `users.role`:** The column was introduced in `0018_user_roles.sql`. The `db/README.md`
previously listed only `0001` and `0002` in this section, which caused confusion. All migrations
apply in lexical order; the full chain must be applied for the application to start correctly.

After applying migrations, run `pnpm db:contracts` to verify that the application-required columns
are present in the live database. This catches migration gaps before tests or deployments.

## Running Migrations

1. Copy `.env.example` to `.env` if you need local overrides.
2. Start PostgreSQL:
   `pnpm db:up`
3. Apply pending migrations:
   `pnpm db:migrate`
4. Verify DB/schema compatibility:
   `pnpm db:contracts`
5. Check migration status:
   `pnpm db:status`

The migration runner applies files in lexical order and records them in the `schema_migrations` table.
If an older applied migration filename is no longer present in `db/migrations`, status reports it as
`applied-missing` so migration history drift stays visible instead of being silently ignored.
