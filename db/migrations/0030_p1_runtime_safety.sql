-- P1 runtime safety contract extensions.

ALTER TABLE queues
    ADD COLUMN IF NOT EXISTS retry_delay_seconds integer NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS max_wait_seconds integer NOT NULL DEFAULT 120,
    ADD COLUMN IF NOT EXISTS music_on_hold text,
    ADD COLUMN IF NOT EXISTS overflow_target_type text,
    ADD COLUMN IF NOT EXISTS overflow_target_id uuid;

ALTER TABLE queues
    DROP CONSTRAINT IF EXISTS queues_retry_delay_seconds_check;

ALTER TABLE queues
    ADD CONSTRAINT queues_retry_delay_seconds_check
    CHECK (retry_delay_seconds BETWEEN 0 AND 300);

ALTER TABLE queues
    DROP CONSTRAINT IF EXISTS queues_max_wait_seconds_check;

ALTER TABLE queues
    ADD CONSTRAINT queues_max_wait_seconds_check
    CHECK (max_wait_seconds BETWEEN 1 AND 3600);

ALTER TABLE queues
    DROP CONSTRAINT IF EXISTS queues_overflow_target_check;

ALTER TABLE queues
    ADD CONSTRAINT queues_overflow_target_check
    CHECK (
        (overflow_target_type IS NULL AND overflow_target_id IS NULL)
        OR (
            overflow_target_type IN ('extension', 'call_group', 'queue', 'voicemail_box', 'flow')
            AND overflow_target_id IS NOT NULL
        )
    );

ALTER TABLE outbound_routes
    ADD COLUMN IF NOT EXISTS allowed_destination_prefixes_json jsonb,
    ADD COLUMN IF NOT EXISTS blocked_destination_prefixes_json jsonb;

COMMENT ON COLUMN outbound_routes.allowed_destination_prefixes_json IS
    'Optional route-level outbound destination allowlist. When present, dial numbers must match at least one prefix.';

COMMENT ON COLUMN outbound_routes.blocked_destination_prefixes_json IS
    'Optional route-level outbound destination blocklist. Dial numbers matching a prefix are rejected before dispatch.';

CREATE INDEX IF NOT EXISTS idx_outbound_call_requests_route_status
    ON outbound_call_requests (tenant_id, route_id, status, created_at DESC);

