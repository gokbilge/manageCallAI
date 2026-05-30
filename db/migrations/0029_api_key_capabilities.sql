-- Capability-limited API keys.
--
-- Previously all API keys were issued with effective tenant_admin capabilities.
-- This migration adds an explicit capabilities list to automation_api_keys so
-- keys can be scoped to only the operations an AI agent or automation needs.
--
-- An empty array means "no capabilities" — the application enforces this.
-- Existing keys default to the full tenant_admin capability set via a
-- sentinel value ('*') so existing integrations continue to work.
-- New keys should always specify an explicit capability list.

ALTER TABLE automation_api_keys
    ADD COLUMN IF NOT EXISTS capabilities text[] NOT NULL DEFAULT ARRAY['*'];

COMMENT ON COLUMN automation_api_keys.capabilities IS
    'Explicit capability list for this key. '
    'A single-element array containing ''*'' grants the full tenant_admin capability '
    'set (legacy default for existing keys). New keys should always specify an '
    'explicit subset. An empty array grants no capabilities.';
