-- Long-lived API keys for automation clients (n8n, scripts).
-- Only the SHA-256 hash is stored; the raw key is shown once on creation.
CREATE TABLE IF NOT EXISTS automation_api_keys (
    id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        text    NOT NULL,
    key_prefix  text    NOT NULL,   -- first 8 hex chars of the random portion (display only)
    key_hash    text    NOT NULL UNIQUE,
    created_by  uuid    REFERENCES users(id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    revoked_at  timestamptz
);

-- Outbound webhook registrations. signing_secret is stored so we can sign delivery payloads.
CREATE TABLE IF NOT EXISTS automation_webhooks (
    id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name           text    NOT NULL,
    url            text    NOT NULL,
    events         text[]  NOT NULL DEFAULT '{}',
    signing_secret text    NOT NULL,
    created_by     uuid    REFERENCES users(id),
    created_at     timestamptz NOT NULL DEFAULT now(),
    revoked_at     timestamptz
);
