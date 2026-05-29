CREATE TABLE IF NOT EXISTS outbound_routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    match_prefix text NOT NULL,
    priority integer NOT NULL DEFAULT 100,
    sip_trunk_id uuid NOT NULL REFERENCES sip_trunks(id),
    fallback_sip_trunk_id uuid REFERENCES sip_trunks(id),
    max_calls_per_minute integer,
    allowed_caller_id_numbers_json jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT outbound_routes_trunk_no_self_fallback
        CHECK (fallback_sip_trunk_id IS NULL OR fallback_sip_trunk_id <> sip_trunk_id)
);

CREATE INDEX IF NOT EXISTS idx_outbound_routes_tenant
    ON outbound_routes (tenant_id, status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outbound_routes_prefix
    ON outbound_routes (tenant_id, match_prefix, priority);
