CREATE TABLE IF NOT EXISTS user_presence (
    user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    status     text NOT NULL DEFAULT 'available'
               CHECK (status IN ('available', 'away', 'busy', 'dnd', 'offline')),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_presence_tenant
    ON user_presence (tenant_id, status);

COMMENT ON TABLE user_presence IS
    'Tenant-scoped presence/status record per user. One row per user; upserted on change.';
