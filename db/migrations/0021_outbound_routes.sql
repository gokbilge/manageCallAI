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

ALTER TABLE outbound_routes
    ADD COLUMN IF NOT EXISTS match_prefix text;

ALTER TABLE outbound_routes
    ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100;

ALTER TABLE outbound_routes
    ADD COLUMN IF NOT EXISTS sip_trunk_id uuid REFERENCES sip_trunks(id);

ALTER TABLE outbound_routes
    ADD COLUMN IF NOT EXISTS fallback_sip_trunk_id uuid REFERENCES sip_trunks(id);

ALTER TABLE outbound_routes
    ADD COLUMN IF NOT EXISTS max_calls_per_minute integer;

ALTER TABLE outbound_routes
    ADD COLUMN IF NOT EXISTS allowed_caller_id_numbers_json jsonb;

UPDATE outbound_routes
SET status = 'inactive'
WHERE status = 'draft';

UPDATE outbound_routes
SET status = 'active'
WHERE status NOT IN ('active', 'inactive');

UPDATE outbound_routes
SET match_prefix = COALESCE(match_prefix, destination_pattern, '')
WHERE match_prefix IS NULL;

ALTER TABLE outbound_routes
    ALTER COLUMN match_prefix SET NOT NULL;

ALTER TABLE outbound_routes
    DROP CONSTRAINT IF EXISTS outbound_routes_status_check;

ALTER TABLE outbound_routes
    ADD CONSTRAINT outbound_routes_status_check
        CHECK (status IN ('active', 'inactive'));

ALTER TABLE outbound_routes
    DROP CONSTRAINT IF EXISTS outbound_routes_trunk_no_self_fallback;

ALTER TABLE outbound_routes
    ADD CONSTRAINT outbound_routes_trunk_no_self_fallback
        CHECK (fallback_sip_trunk_id IS NULL OR fallback_sip_trunk_id <> sip_trunk_id);

CREATE INDEX IF NOT EXISTS idx_outbound_routes_tenant
    ON outbound_routes (tenant_id, status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outbound_routes_prefix
    ON outbound_routes (tenant_id, match_prefix, priority);
