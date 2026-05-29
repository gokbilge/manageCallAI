CREATE TABLE IF NOT EXISTS ivr_flow_session_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id uuid NOT NULL REFERENCES ivr_flow_sessions(id) ON DELETE CASCADE,
    step_index integer NOT NULL,
    phase text NOT NULL CHECK (phase IN ('start', 'advance')),
    node_id text,
    outcome text NOT NULL CHECK (outcome IN ('start', 'completed', 'digits', 'timeout', 'invalid')),
    digits text,
    action_json jsonb,
    resulting_node_id text,
    resulting_status text NOT NULL CHECK (resulting_status IN ('running', 'completed', 'failed')),
    variables_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, step_index)
);

CREATE INDEX IF NOT EXISTS idx_ivr_flow_session_steps_session_id
    ON ivr_flow_session_steps (tenant_id, session_id, step_index);
