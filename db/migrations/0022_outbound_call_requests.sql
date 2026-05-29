CREATE TABLE IF NOT EXISTS outbound_call_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    extension_id uuid NOT NULL REFERENCES extensions(id),
    dial_number text NOT NULL,
    route_id uuid REFERENCES outbound_routes(id),
    sip_trunk_id uuid REFERENCES sip_trunks(id),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'dispatched', 'failed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outbound_call_requests_tenant_status_idx
    ON outbound_call_requests (tenant_id, status, created_at DESC);
