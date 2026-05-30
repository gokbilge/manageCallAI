-- RBAC and schema hardening.
--
-- 1. Document and guard the legacy roles/user_roles/role_policies tables.
-- 2. Add actor_type, request_id, old_value, new_value to tenant_audit_log.
-- 3. Enforce tenant-consistent phone number assignment on inbound_routes.
-- 4. Add DB-level format check on automation_api_keys.capabilities.
-- 5. Add E.164 format constraint on phone_numbers.e164_number.
-- 6. Add checksum and applied_by columns to schema_migrations.
-- 7. Add supporting indexes for new query patterns.

-- ── 1. Legacy RBAC tables ──────────────────────────────────────────────────────
-- The roles, user_roles, and role_policies tables were created in 0001 for a
-- custom RBAC model that was superseded by users.role (0018) before any
-- production data was written. They are unused by all application code.

COMMENT ON TABLE roles IS
    'DEPRECATED — unused since 0018_user_roles.sql replaced this with users.role. '
    'Will be dropped once all environments are confirmed empty. '
    'Do not write application code that references this table.';

COMMENT ON TABLE user_roles IS
    'DEPRECATED — join table for the unused custom RBAC model. Will be dropped '
    'with the roles table.';

COMMENT ON TABLE role_policies IS
    'DEPRECATED — policy-assignment table for the unused custom RBAC model. Will '
    'be dropped with the roles table.';

COMMENT ON COLUMN users.role IS
    'Persisted tenant role. Canonical values: tenant_admin, tenant_operator, '
    'tenant_viewer. The platform_admin value is accepted by the CHECK constraint '
    'as a safety net but is never written by normal application flows — it is '
    'computed at JWT-issuance time from PLATFORM_OPERATOR_EMAILS and carries no '
    'meaning inside the database. See 0027_role_model_cleanup.sql.';

-- Guard: abort migration if legacy tables contain data in this environment.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM roles LIMIT 1) THEN
        RAISE EXCEPTION
            'BLOCKED: The roles table is not empty in this environment. '
            'Investigate before applying this migration. '
            'If the data is test data, TRUNCATE roles, user_roles, role_policies first.';
    END IF;
END $$;

-- ── 2. tenant_audit_log: new columns ─────────────────────────────────────────
-- actor_type distinguishes human users from API key clients and system processes.
ALTER TABLE tenant_audit_log
    ADD COLUMN IF NOT EXISTS actor_type text
        CHECK (actor_type IN ('user', 'api_key', 'system', 'runtime'));

-- request_id links the audit row to the HTTP request log for correlation.
-- Populated from the x-request-id response header / request context.
ALTER TABLE tenant_audit_log
    ADD COLUMN IF NOT EXISTS request_id text;

-- old_value and new_value enable diff-style audit rendering for mutations.
-- Populated for role changes, capability changes, and status transitions.
ALTER TABLE tenant_audit_log
    ADD COLUMN IF NOT EXISTS old_value jsonb;

ALTER TABLE tenant_audit_log
    ADD COLUMN IF NOT EXISTS new_value jsonb;

-- Index: actor-scoped activity view (e.g. "show all actions by user X")
CREATE INDEX IF NOT EXISTS tenant_audit_log_actor_idx
    ON tenant_audit_log (tenant_id, actor_id, created_at DESC)
    WHERE actor_id IS NOT NULL;

-- Index: resource-history view (e.g. "show all changes to extension Y")
CREATE INDEX IF NOT EXISTS tenant_audit_log_resource_idx
    ON tenant_audit_log (tenant_id, resource_type, resource_id, created_at DESC)
    WHERE resource_id IS NOT NULL;

-- ── 3. Tenant-consistent phone number assignment ───────────────────────────────
-- inbound_routes.phone_number_id references phone_numbers(id) but the existing
-- FK does not enforce that both rows belong to the same tenant. This trigger
-- closes that gap.

CREATE OR REPLACE FUNCTION check_phone_number_tenant()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.phone_number_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM phone_numbers
             WHERE id = NEW.phone_number_id
               AND tenant_id = NEW.tenant_id
        ) THEN
            RAISE EXCEPTION
                'phone_number_id % does not belong to tenant %',
                NEW.phone_number_id, NEW.tenant_id
                USING ERRCODE = 'foreign_key_violation';
        END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS inbound_routes_phone_number_tenant_check ON inbound_routes;
CREATE TRIGGER inbound_routes_phone_number_tenant_check
    BEFORE INSERT OR UPDATE OF phone_number_id, tenant_id ON inbound_routes
    FOR EACH ROW EXECUTE FUNCTION check_phone_number_tenant();

-- ── 4. Tenant-consistent queue member extensions ──────────────────────────────
CREATE OR REPLACE FUNCTION check_queue_member_tenant()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM extensions
         WHERE id = NEW.extension_id
           AND tenant_id = NEW.tenant_id
    ) THEN
        RAISE EXCEPTION
            'extension_id % does not belong to tenant %',
            NEW.extension_id, NEW.tenant_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS queue_members_extension_tenant_check ON queue_members;
CREATE TRIGGER queue_members_extension_tenant_check
    BEFORE INSERT OR UPDATE OF extension_id, tenant_id ON queue_members
    FOR EACH ROW EXECUTE FUNCTION check_queue_member_tenant();

-- ── 5. Tenant-consistent voicemail greeting prompt ────────────────────────────
CREATE OR REPLACE FUNCTION check_voicemail_greeting_tenant()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.greeting_prompt_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM prompt_assets
             WHERE id = NEW.greeting_prompt_id
               AND tenant_id = NEW.tenant_id
        ) THEN
            RAISE EXCEPTION
                'greeting_prompt_id % does not belong to tenant %',
                NEW.greeting_prompt_id, NEW.tenant_id
                USING ERRCODE = 'foreign_key_violation';
        END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS voicemail_boxes_greeting_tenant_check ON voicemail_boxes;
CREATE TRIGGER voicemail_boxes_greeting_tenant_check
    BEFORE INSERT OR UPDATE OF greeting_prompt_id, tenant_id ON voicemail_boxes
    FOR EACH ROW EXECUTE FUNCTION check_voicemail_greeting_tenant();

-- ── 6. route_versions: add tenant_id to unique constraint ─────────────────────
-- The original constraint (route_type, route_id, version_number) omits tenant_id.
-- Technically safe because route_ids are UUIDs, but semantically incomplete.

ALTER TABLE route_versions
    DROP CONSTRAINT IF EXISTS route_versions_route_type_route_id_version_number_key;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'route_versions_tenant_route_version_unique'
    ) THEN
        ALTER TABLE route_versions
            ADD CONSTRAINT route_versions_tenant_route_version_unique
            UNIQUE (tenant_id, route_type, route_id, version_number);
    END IF;
END $$;

-- ── 7. Capability format on API keys ─────────────────────────────────────────
-- Only the wildcard sentinel '*' or dot-separated lowercase strings are valid.
-- PostgreSQL CHECK constraints cannot contain subqueries, so the validation is
-- wrapped in an IMMUTABLE function which is then called from the constraint.

CREATE OR REPLACE FUNCTION api_key_capabilities_valid(caps text[])
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    -- Legacy wildcard: permitted only until 0039 backfill runs.
    IF caps = ARRAY['*']::text[] THEN RETURN TRUE; END IF;
    -- Empty array: allowed (no-capability key).
    IF cardinality(caps) = 0 THEN RETURN TRUE; END IF;
    -- All elements must match the dot-namespaced capability format.
    RETURN NOT EXISTS (
        SELECT 1 FROM unnest(caps) AS cap
         WHERE cap <> '*'
           AND cap !~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'
    );
END $$;

ALTER TABLE automation_api_keys
    DROP CONSTRAINT IF EXISTS automation_api_keys_capabilities_format;

ALTER TABLE automation_api_keys
    ADD CONSTRAINT automation_api_keys_capabilities_format
        CHECK (api_key_capabilities_valid(capabilities));

-- ── 8. E.164 format on phone numbers ─────────────────────────────────────────
-- '+' followed by 1-9, then 6-14 more digits (ITU-T E.164 range: 7-15 total).
-- Existing rows that violate the format will cause this migration to fail.
-- Run: SELECT e164_number FROM phone_numbers WHERE e164_number !~ '^\+[1-9][0-9]{6,14}$'
-- before applying to identify any non-conformant rows.

ALTER TABLE phone_numbers
    DROP CONSTRAINT IF EXISTS phone_numbers_e164_format;

ALTER TABLE phone_numbers
    ADD CONSTRAINT phone_numbers_e164_format
        CHECK (e164_number ~ '^\+[1-9][0-9]{6,14}$');

-- ── 9. Non-empty password_hash guard ─────────────────────────────────────────
-- Migration 0002 set DEFAULT '' as a placeholder comment. Ensure no user can be
-- left with an empty hash (which would make bcrypt.compare always fail).

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_password_hash_not_empty;

ALTER TABLE users
    ADD CONSTRAINT users_password_hash_not_empty
        CHECK (password_hash <> '');

-- Backfill: any row still holding the empty default gets a random unusable hash.
UPDATE users
   SET password_hash = 'LOCKED:' || encode(gen_random_bytes(32), 'hex')
 WHERE password_hash = '';

-- ── 10. schema_migrations: tamper-detection columns ───────────────────────────
ALTER TABLE schema_migrations
    ADD COLUMN IF NOT EXISTS sha256_hex  text,
    ADD COLUMN IF NOT EXISTS applied_by  text;

COMMENT ON COLUMN schema_migrations.sha256_hex IS
    'SHA-256 hex digest of the migration file content at apply time (LF-normalised). '
    'NULL for migrations applied before 0037. Populated by db/migrate.mjs.';

COMMENT ON COLUMN schema_migrations.applied_by IS
    'CI pipeline ID or local username that applied this migration.';

-- ── 11. Additional supporting indexes ─────────────────────────────────────────
-- Active users by role (admin dashboard, role-filtered listing)
CREATE INDEX IF NOT EXISTS users_tenant_role_active_idx
    ON users (tenant_id, role)
    WHERE status = 'active';

-- Non-revoked API keys hash lookup (hot path for every API-key request)
CREATE UNIQUE INDEX IF NOT EXISTS automation_api_keys_active_hash_idx
    ON automation_api_keys (key_hash)
    WHERE revoked_at IS NULL;

-- Active webhooks per tenant (delivery enqueue path)
CREATE INDEX IF NOT EXISTS automation_webhooks_tenant_active_idx
    ON automation_webhooks (tenant_id, created_at DESC)
    WHERE revoked_at IS NULL;

-- Draft flow versions (createVersion + updateVersionDefinition hot path)
CREATE INDEX IF NOT EXISTS flow_versions_draft_per_flow_idx
    ON flow_versions (flow_id, tenant_id)
    WHERE state = 'draft';

-- audit_events actor index (enables UNION query across both audit tables)
CREATE INDEX IF NOT EXISTS audit_events_actor_idx
    ON audit_events (tenant_id, actor_id, created_at DESC)
    WHERE actor_id IS NOT NULL;
