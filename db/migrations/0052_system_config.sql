-- SLICE-60: Setup bootstrap sentinel and platform-level configuration store
--
-- system_config holds exactly one row per key. The setup_complete key
-- is written once during first-run setup and locks the /setup route permanently.
-- The table is intentionally general-purpose for future operator flags.

CREATE TABLE IF NOT EXISTS system_config (
    key        text PRIMARY KEY,
    value      text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE system_config IS
    'Platform-level key/value configuration. setup_complete=true means first-run '
    'setup has been completed and the /setup route is permanently locked (404).';

COMMENT ON COLUMN system_config.key IS
    'Configuration key. Known values: setup_complete.';

COMMENT ON COLUMN system_config.value IS
    'Configuration value. For boolean flags, stored as the string "true".';
