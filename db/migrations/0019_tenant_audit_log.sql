CREATE TABLE IF NOT EXISTS tenant_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    actor_id uuid,
    actor_role text,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    metadata_json jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_audit_log_tenant_idx
    ON tenant_audit_log (tenant_id, created_at DESC);
