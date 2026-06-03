-- SLICE-63: Gateway reload / runtime apply requests
--
-- Tracks safe ESL command sequences triggered after SIP trunk changes.
-- The Go agent polls for pending requests, executes the allowlisted commands,
-- and posts results back. Only allowlisted action types are accepted.

CREATE TABLE IF NOT EXISTS runtime_apply_requests (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- null = platform-level action (no specific tenant)
    tenant_id           uuid REFERENCES tenants(id) ON DELETE CASCADE,
    triggered_by_type   text NOT NULL CHECK (triggered_by_type IN ('user', 'workflow', 'system')),
    triggered_by_id     uuid,
    -- allowlisted safe action types only — no arbitrary ESL
    action_type         text NOT NULL CHECK (action_type IN (
                            'reloadxml',
                            'sofia_profile_rescan',
                            'sofia_profile_killgw',
                            'sofia_profile_restartgw',
                            'sofia_status_gateway',
                            'sofia_status_profile'
                        )),
    target_node_id      uuid NOT NULL REFERENCES freeswitch_nodes(id),
    target_profile      text,
    target_gateway      text,
    object_type         text NOT NULL,
    object_id           uuid NOT NULL,
    status              text NOT NULL DEFAULT 'pending' CHECK (status IN (
                            'pending', 'applying', 'applied', 'failed', 'cancelled'
                        )),
    active_call_count   int,
    applied_at          timestamptz,
    error_message       text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runtime_apply_requests_pending
    ON runtime_apply_requests (target_node_id, status)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_runtime_apply_requests_tenant
    ON runtime_apply_requests (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_runtime_apply_requests_object
    ON runtime_apply_requests (object_type, object_id);

COMMENT ON TABLE runtime_apply_requests IS
    'Safe ESL command sequences queued after trunk/config changes. '
    'The Go agent polls for pending rows, executes the allowlisted command, '
    'and updates status. Only allowlisted action_types are permitted.';
