CREATE TABLE IF NOT EXISTS ivr_flow_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    flow_id uuid NOT NULL REFERENCES ivr_flows(id) ON DELETE CASCADE,
    flow_version_id uuid NOT NULL REFERENCES flow_versions(id) ON DELETE RESTRICT,
    call_id text NOT NULL,
    status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    current_node_id text,
    caller_number text,
    destination_number text,
    last_digits text,
    variables_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    last_action_json jsonb,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, call_id)
);

CREATE INDEX IF NOT EXISTS idx_ivr_flow_sessions_call_id
    ON ivr_flow_sessions (tenant_id, call_id);

CREATE INDEX IF NOT EXISTS idx_ivr_flow_sessions_status
    ON ivr_flow_sessions (tenant_id, status, created_at DESC);
