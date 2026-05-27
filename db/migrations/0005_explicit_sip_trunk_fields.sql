-- Migration 0005: Replace legacy JSONB-based sip_trunks fields with explicit columns.
--
-- Fresh installs already get the explicit columns from 0001_initial_schema.sql.
-- This migration upgrades older local databases that still have:
--   provider_name
--   authentication_profile
--   auth_secret_ciphertext
--   auth_secret_key_id
--   auth_secret_ref
--   network_profile

ALTER TABLE sip_trunks
  ADD COLUMN IF NOT EXISTS realm TEXT,
  ADD COLUMN IF NOT EXISTS proxy TEXT,
  ADD COLUMN IF NOT EXISTS port INTEGER,
  ADD COLUMN IF NOT EXISTS transport TEXT,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS auth_username TEXT,
  ADD COLUMN IF NOT EXISTS auth_password_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS auth_password_key_id TEXT;

DO $$
DECLARE
  has_authentication_profile boolean;
  has_network_profile boolean;
  has_auth_secret_ciphertext boolean;
  has_auth_secret_key_id boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sip_trunks'
      AND column_name = 'authentication_profile'
  ) INTO has_authentication_profile;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sip_trunks'
      AND column_name = 'network_profile'
  ) INTO has_network_profile;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sip_trunks'
      AND column_name = 'auth_secret_ciphertext'
  ) INTO has_auth_secret_ciphertext;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sip_trunks'
      AND column_name = 'auth_secret_key_id'
  ) INTO has_auth_secret_key_id;

  IF has_authentication_profile OR has_network_profile OR has_auth_secret_ciphertext OR has_auth_secret_key_id THEN
    EXECUTE format(
      $sql$
      UPDATE sip_trunks
      SET
        realm = COALESCE(
          realm,
          %1$s,
          %2$s,
          ''
        ),
        proxy = COALESCE(
          proxy,
          %3$s,
          %4$s,
          ''
        ),
        port = COALESCE(
          port,
          %5$s,
          %6$s,
          5060
        ),
        transport = COALESCE(
          transport,
          %7$s,
          %8$s,
          'udp'
        ),
        username = COALESCE(
          username,
          %9$s
        ),
        auth_username = COALESCE(
          auth_username,
          %10$s,
          %11$s,
          ''
        ),
        auth_password_ciphertext = COALESCE(
          auth_password_ciphertext,
          %12$s
        ),
        auth_password_key_id = COALESCE(
          auth_password_key_id,
          %13$s
        )
      $sql$,
      CASE WHEN has_authentication_profile THEN 'NULLIF(authentication_profile->>''realm'', '''')' ELSE 'NULL' END,
      CASE WHEN has_network_profile THEN 'NULLIF(network_profile->>''realm'', '''')' ELSE 'NULL' END,
      CASE WHEN has_network_profile THEN 'NULLIF(network_profile->>''proxy'', '''')' ELSE 'NULL' END,
      CASE WHEN has_authentication_profile THEN 'NULLIF(authentication_profile->>''proxy'', '''')' ELSE 'NULL' END,
      CASE WHEN has_network_profile THEN 'NULLIF(network_profile->>''port'', '''')::integer' ELSE 'NULL' END,
      CASE WHEN has_authentication_profile THEN 'NULLIF(authentication_profile->>''port'', '''')::integer' ELSE 'NULL' END,
      CASE WHEN has_network_profile THEN 'NULLIF(network_profile->>''transport'', '''')' ELSE 'NULL' END,
      CASE WHEN has_authentication_profile THEN 'NULLIF(authentication_profile->>''transport'', '''')' ELSE 'NULL' END,
      CASE WHEN has_authentication_profile THEN 'NULLIF(authentication_profile->>''username'', '''')' ELSE 'NULL' END,
      CASE WHEN has_authentication_profile THEN 'NULLIF(authentication_profile->>''auth_username'', '''')' ELSE 'NULL' END,
      CASE WHEN has_authentication_profile THEN 'NULLIF(authentication_profile->>''username'', '''')' ELSE 'NULL' END,
      CASE WHEN has_auth_secret_ciphertext THEN 'auth_secret_ciphertext' ELSE 'NULL' END,
      CASE WHEN has_auth_secret_key_id THEN 'auth_secret_key_id' ELSE 'NULL' END
    );
  END IF;
END $$;

-- Older development rows may not contain enough secret data to migrate safely.
-- Since this repository is still in early-stage development, remove incomplete
-- rows so the stricter NOT NULL constraints can be applied cleanly.
DELETE FROM sip_trunks
WHERE realm IS NULL
   OR proxy IS NULL
   OR port IS NULL
   OR transport IS NULL
   OR auth_username IS NULL
   OR auth_password_ciphertext IS NULL
   OR auth_password_key_id IS NULL
   OR realm = ''
   OR proxy = ''
   OR auth_username = '';

ALTER TABLE sip_trunks
  ALTER COLUMN realm SET NOT NULL,
  ALTER COLUMN proxy SET NOT NULL,
  ALTER COLUMN port SET NOT NULL,
  ALTER COLUMN port SET DEFAULT 5060,
  ALTER COLUMN transport SET NOT NULL,
  ALTER COLUMN transport SET DEFAULT 'udp',
  ALTER COLUMN auth_username SET NOT NULL,
  ALTER COLUMN auth_password_ciphertext SET NOT NULL,
  ALTER COLUMN auth_password_key_id SET NOT NULL;

ALTER TABLE sip_trunks
  DROP COLUMN IF EXISTS provider_name,
  DROP COLUMN IF EXISTS authentication_profile,
  DROP COLUMN IF EXISTS auth_secret_ciphertext,
  DROP COLUMN IF EXISTS auth_secret_key_id,
  DROP COLUMN IF EXISTS auth_secret_ref,
  DROP COLUMN IF EXISTS network_profile;
