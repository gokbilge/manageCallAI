-- Migration 0004: Replace plaintext sip_password with encrypted-at-rest storage.
--
-- The API layer uses AES-256-GCM (Node.js crypto). Ciphertexts are stored as
-- base64(iv).base64(authTag).base64(ciphertext) in sip_password_ciphertext.
-- sip_password_key_id records which environment key was used, enabling future
-- key rotation without re-encrypting in SQL.

ALTER TABLE extensions
  ADD COLUMN IF NOT EXISTS sip_password_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS sip_password_key_id TEXT;

-- Existing rows stored the password in plaintext. We cannot encrypt them here
-- without the application key. Since this is an early-stage development
-- repository with no production data, we remove the rows so the NOT NULL
-- constraint can be applied cleanly. Run a re-keying script in place of this
-- DELETE for any environment that has data worth preserving.
DELETE FROM extensions WHERE sip_password_ciphertext IS NULL;

ALTER TABLE extensions
  ALTER COLUMN sip_password_ciphertext SET NOT NULL,
  ALTER COLUMN sip_password_key_id SET NOT NULL;

ALTER TABLE extensions
  DROP COLUMN IF EXISTS sip_password;
