-- SLICE-43: FreeSWITCH Node Registry and Runtime Edge Gateway
--
-- Adds the node registry that tracks known FreeSWITCH instances and their
-- cryptographic identities. Each node signs its runtime HTTP requests with
-- HMAC-SHA256 using a per-node secret stored encrypted (AES-256-GCM).
--
-- Nonces provide request-replay protection for the 5-minute timestamp window.

-- ── Node registry ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS freeswitch_nodes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name    text NOT NULL,

    -- Status lifecycle: active → disabled → decommissioned
    status          text NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'disabled', 'decommissioned')),

    -- Node HMAC signing key, encrypted AES-256-GCM (same scheme as SIP passwords).
    -- Raw key is only returned once on creation/rotation.
    token_encrypted text NOT NULL,
    token_key_id    text NOT NULL,

    -- Allowed source IP ranges in CIDR notation. Empty array means any source.
    allowed_cidrs   text[] NOT NULL DEFAULT '{}',

    -- Endpoint capability families this node may call.
    capabilities    text[] NOT NULL DEFAULT
                         '{dialplan,directory,event_ingest,outbound_poll}',

    -- Per-endpoint-family rate limit overrides (jsonb, merged with global defaults).
    rate_limit_policy jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS freeswitch_nodes_status ON freeswitch_nodes (status);

COMMENT ON TABLE freeswitch_nodes IS
    'Registry of known FreeSWITCH nodes. Each node authenticates runtime HTTP requests with HMAC-SHA256.';

-- ── Nonce store (replay protection) ──────────────────────────────────────────
-- Each nonce is consumed on first use. Expired entries are cleaned up by the
-- runtime worker or an on-demand cleanup call.
-- The expires_at is set to (request_timestamp + 10 minutes) so nonces never
-- outlive the timestamp freshness window.

CREATE TABLE IF NOT EXISTS runtime_nonces (
    node_id    uuid    NOT NULL REFERENCES freeswitch_nodes(id) ON DELETE CASCADE,
    nonce      text    NOT NULL,
    expires_at timestamptz NOT NULL,
    PRIMARY KEY (node_id, nonce)
);

CREATE INDEX IF NOT EXISTS runtime_nonces_expires ON runtime_nonces (expires_at);

COMMENT ON TABLE runtime_nonces IS
    'One-time nonces for HMAC-signed node requests. Entries expire after 10 minutes.';
