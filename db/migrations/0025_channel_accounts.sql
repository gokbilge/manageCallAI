CREATE TABLE IF NOT EXISTS channel_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_type text NOT NULL
        CHECK (provider_type IN ('whatsapp', 'telegram', 'google_meet', 'custom')),
    name text NOT NULL,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    capabilities text[] NOT NULL DEFAULT '{}',
    provider_config jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS channel_accounts_tenant_idx ON channel_accounts (tenant_id, status);

CREATE TABLE IF NOT EXISTS channel_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel_account_id uuid NOT NULL REFERENCES channel_accounts(id),
    direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type text NOT NULL
        CHECK (message_type IN ('text', 'voice_message', 'meeting', 'image', 'document')),
    external_id text,
    sender_id text,
    recipient_id text,
    body text,
    media_reference text,
    provider_metadata jsonb NOT NULL DEFAULT '{}',
    received_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS channel_messages_tenant_account_idx
    ON channel_messages (tenant_id, channel_account_id, received_at DESC);

CREATE TABLE IF NOT EXISTS channel_message_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel_account_id uuid NOT NULL REFERENCES channel_accounts(id),
    recipient_id text NOT NULL,
    message_type text NOT NULL
        CHECK (message_type IN ('text', 'voice_message', 'meeting', 'image', 'document')),
    body text,
    media_reference text,
    status text NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'sent', 'failed')),
    failure_reason text,
    provider_metadata jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS channel_message_requests_tenant_idx
    ON channel_message_requests (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS meeting_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel_account_id uuid NOT NULL REFERENCES channel_accounts(id),
    meeting_code text,
    meeting_url text,
    status text NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'active', 'completed', 'failed')),
    participant_count integer NOT NULL DEFAULT 0,
    recording_reference text,
    transcript_reference text,
    provider_metadata jsonb NOT NULL DEFAULT '{}',
    started_at timestamptz,
    ended_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meeting_sessions_tenant_idx
    ON meeting_sessions (tenant_id, status, created_at DESC);
