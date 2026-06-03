-- SLICE-64: End-user self-service portal
--
-- Adds per-extension self-service state columns, end_user role support,
-- and tenant-level capability policy for self-service features.

-- Allow 'end_user' as a valid role value alongside existing roles.
-- Patch the existing CHECK constraint by dropping and re-adding it.
-- Note: platform_admin is JWT-only and is NOT stored in users.role.
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
    ADD CONSTRAINT users_role_check
        CHECK (role IN ('tenant_admin', 'tenant_operator', 'tenant_viewer', 'end_user'));

-- Per-extension self-service settable state.
-- These columns are owned by the extension owner and writable via /me/* endpoints.
ALTER TABLE extensions
    ADD COLUMN IF NOT EXISTS dnd_enabled           boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS call_forward_enabled  boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS call_forward_target   text,  -- E.164 or extension number
    ADD COLUMN IF NOT EXISTS voicemail_pin_hash    text;  -- bcrypt hash, null = no PIN set

-- Tenant-level self-service capability policy.
-- Tenant admin controls which features end users may self-manage.
CREATE TABLE IF NOT EXISTS end_user_self_service_policies (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    voicemail_view              boolean NOT NULL DEFAULT true,
    voicemail_pin_change        boolean NOT NULL DEFAULT true,
    dnd_manage                  boolean NOT NULL DEFAULT true,
    call_forward_manage         boolean NOT NULL DEFAULT false,
    call_forward_set_target     boolean NOT NULL DEFAULT false,
    call_history_view           boolean NOT NULL DEFAULT true,
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE end_user_self_service_policies IS
    'Per-tenant capability gates for end-user self-service features. '
    'Absent row = all defaults apply. Created lazily on first PATCH.';

COMMENT ON COLUMN extensions.dnd_enabled IS
    'Do Not Disturb state for this extension. Writable via /me/dnd endpoint.';

COMMENT ON COLUMN extensions.call_forward_target IS
    'Call forward destination (E.164 or extension number). '
    'Blank when call_forward_enabled is false.';

COMMENT ON COLUMN extensions.voicemail_pin_hash IS
    'bcrypt hash of the user-set voicemail PIN. Null = not set (system default applies).';
