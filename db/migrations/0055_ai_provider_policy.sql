CREATE TABLE IF NOT EXISTS tenant_ai_policy_overrides (
    tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    provider_backed_enabled boolean NOT NULL DEFAULT false,
    prompt_generation_enabled boolean NOT NULL DEFAULT false,
    prompt_generation_preferred_provider text
        CHECK (
            prompt_generation_preferred_provider IS NULL
            OR prompt_generation_preferred_provider IN ('openai', 'elevenlabs', 'whisper', 'external', 'custom')
        ),
    ivr_ai_turn_enabled boolean NOT NULL DEFAULT false,
    ivr_ai_turn_preferred_provider text
        CHECK (
            ivr_ai_turn_preferred_provider IS NULL
            OR ivr_ai_turn_preferred_provider IN ('openai', 'elevenlabs', 'whisper', 'external', 'custom')
        ),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_ai_policy_overrides_updated_idx
    ON tenant_ai_policy_overrides (updated_at DESC);

COMMENT ON TABLE tenant_ai_policy_overrides IS
    'Tenant-scoped opt-in and preferred-provider overrides for provider-backed AI features. Platform policy remains authoritative.';
