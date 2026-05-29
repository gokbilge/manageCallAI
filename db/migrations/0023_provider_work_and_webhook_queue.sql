CREATE TABLE IF NOT EXISTS webhook_delivery_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id uuid NOT NULL REFERENCES automation_webhooks(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event text NOT NULL,
    payload_json jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'abandoned')),
    attempt_count integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 3,
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    claimed_at timestamptz,
    delivered_at timestamptz,
    last_response_code integer,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_delivery_queue_due_idx
    ON webhook_delivery_queue (status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS webhook_delivery_queue_tenant_idx
    ON webhook_delivery_queue (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS recording_analysis_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    recording_id uuid NOT NULL REFERENCES call_recordings(id) ON DELETE CASCADE,
    requested_outputs text[] NOT NULL,
    language_hint text,
    status text NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    processor_id text,
    claimed_at timestamptz,
    language text,
    transcript_text text,
    summary_text text,
    error_message text,
    provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS recording_analysis_requests_recording_idx
    ON recording_analysis_requests (tenant_id, recording_id, created_at DESC);

CREATE INDEX IF NOT EXISTS recording_analysis_requests_status_idx
    ON recording_analysis_requests (status, created_at);

CREATE TABLE IF NOT EXISTS prompt_generation_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    prompt_asset_id uuid REFERENCES prompt_assets(id) ON DELETE SET NULL,
    requested_outputs text[] NOT NULL,
    input_text text NOT NULL,
    language_hint text,
    voice_hint text,
    provider_hint text NOT NULL DEFAULT 'auto',
    status text NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    processor_id text,
    claimed_at timestamptz,
    generated_prompt_asset_id uuid REFERENCES prompt_assets(id) ON DELETE SET NULL,
    media_reference text,
    error_message text,
    provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS prompt_generation_requests_tenant_idx
    ON prompt_generation_requests (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS prompt_generation_requests_status_idx
    ON prompt_generation_requests (status, created_at);

CREATE TABLE IF NOT EXISTS ivr_ai_turn_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    runtime_session_id uuid REFERENCES ivr_flow_sessions(id) ON DELETE SET NULL,
    call_id text NOT NULL,
    flow_id uuid REFERENCES ivr_flows(id) ON DELETE SET NULL,
    node_id text NOT NULL,
    input_mode text NOT NULL CHECK (input_mode IN ('text', 'transcript', 'dtmf', 'metadata')),
    input_text text,
    requested_outputs text[] NOT NULL,
    provider_hint text NOT NULL DEFAULT 'auto',
    status text NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    processor_id text,
    claimed_at timestamptz,
    answer_text text,
    next_action jsonb,
    confidence numeric,
    error_message text,
    provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ivr_ai_turn_requests_session_idx
    ON ivr_ai_turn_requests (tenant_id, runtime_session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ivr_ai_turn_requests_status_idx
    ON ivr_ai_turn_requests (status, created_at);
