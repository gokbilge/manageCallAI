-- SLICE-45: Tenant Outbound Fraud Policy
--
-- Adds tenant-level outbound fraud controls above the route-level prefix rules.
-- New tenants inherit the default policy (deny_international_default = true).
-- Emergency and premium-rate global blocks remain non-bypassable by tenant admins.

CREATE TABLE IF NOT EXISTS tenant_outbound_policies (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,

    -- Country calling-code allowlist (+1, +44, +90 …). Empty = all countries permitted.
    country_allowlist       text[] NOT NULL DEFAULT '{}',

    -- Area-code allowlist (more specific than country; e.g. +1415). Empty = unrestricted.
    areacode_allowlist      text[] NOT NULL DEFAULT '{}',

    -- Additional premium-rate prefixes beyond the global hardcoded list.
    premium_rate_blocklist  text[] NOT NULL DEFAULT '{}',

    -- High-risk destination prefixes (e.g. IPRN ranges, certain toll routes).
    high_risk_blocklist     text[] NOT NULL DEFAULT '{}',

    -- Tenant-wide per-hour and per-day call attempt caps. NULL = no cap.
    max_calls_per_hour      integer CHECK (max_calls_per_hour IS NULL OR max_calls_per_hour > 0),
    max_calls_per_day       integer CHECK (max_calls_per_day IS NULL OR max_calls_per_day > 0),

    -- Maximum call duration in seconds passed to FreeSWITCH dispatch. NULL = no limit.
    max_call_duration_secs  integer CHECK (max_call_duration_secs IS NULL OR max_call_duration_secs > 0),

    -- When true, only destinations matching country_allowlist or areacode_allowlist
    -- are permitted. Defaults to false so existing tenants are not broken on migration.
    deny_international_default boolean NOT NULL DEFAULT false,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tenant_outbound_policies IS
    'Tenant-level outbound fraud controls. Evaluated before route-level prefix rules.';

-- ── Global blocked prefixes ────────────────────────────────────────────────────
-- Hardcoded categories that cannot be overridden by any tenant admin.
-- The application also has in-process constants for the most critical prefixes;
-- this table provides operator-visible and auditable entries.

CREATE TABLE IF NOT EXISTS global_blocked_prefixes (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    prefix     text NOT NULL UNIQUE,
    category   text NOT NULL CHECK (category IN ('emergency', 'premium_rate', 'high_risk')),
    reason     text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO global_blocked_prefixes (prefix, category, reason) VALUES
    ('911',   'emergency',    'US/Canada emergency services'),
    ('999',   'emergency',    'UK emergency services'),
    ('112',   'emergency',    'EU emergency services'),
    ('000',   'emergency',    'AU emergency services'),
    ('110',   'emergency',    'DE/JP emergency services'),
    ('118',   'emergency',    'IT emergency services'),
    ('119',   'emergency',    'KR emergency services'),
    ('+1900', 'premium_rate', 'US 1-900 premium rate'),
    ('1900',  'premium_rate', 'US 1-900 premium rate (no plus)'),
    ('+1976', 'premium_rate', 'US 1-976 premium rate'),
    ('1976',  'premium_rate', 'US 1-976 premium rate (no plus)')
ON CONFLICT (prefix) DO NOTHING;

COMMENT ON TABLE global_blocked_prefixes IS
    'Platform-wide blocked destination prefixes. Not overridable by tenant admins.';
