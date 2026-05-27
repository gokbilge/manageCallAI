CREATE TABLE IF NOT EXISTS call_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    strategy text NOT NULL DEFAULT 'simultaneous'
        CHECK (strategy IN ('simultaneous', 'sequential')),
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_groups_tenant
    ON call_groups (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS call_group_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_group_id uuid NOT NULL REFERENCES call_groups(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    extension_id uuid NOT NULL REFERENCES extensions(id) ON DELETE CASCADE,
    position integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (call_group_id, extension_id)
);

CREATE INDEX IF NOT EXISTS idx_call_group_members_group
    ON call_group_members (call_group_id, position);
