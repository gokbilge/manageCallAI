CREATE TABLE IF NOT EXISTS webhook_delivery_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id uuid NOT NULL REFERENCES automation_webhooks(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL,
    event text NOT NULL,
    attempt_number integer NOT NULL DEFAULT 1,
    status text NOT NULL CHECK (status IN ('success', 'failed')),
    response_code integer,
    duration_ms integer,
    attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_delivery_log_webhook_idx
    ON webhook_delivery_log (webhook_id, attempted_at DESC);
