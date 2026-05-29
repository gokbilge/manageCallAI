CREATE TABLE IF NOT EXISTS call_recordings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    call_id text NOT NULL,
    call_event_id uuid REFERENCES call_events(id) ON DELETE SET NULL,
    storage_path text NOT NULL,
    duration_secs integer,
    size_bytes bigint,
    status text NOT NULL DEFAULT 'available'
        CHECK (status IN ('pending', 'available', 'deleted')),
    recorded_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_recordings_tenant_idx
    ON call_recordings (tenant_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS call_recordings_call_id_idx
    ON call_recordings (tenant_id, call_id);
