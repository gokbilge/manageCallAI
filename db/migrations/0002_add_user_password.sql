-- Adds the password hash column required for local credential auth.
-- Existing rows get an empty string placeholder; a real password must be
-- set before any user can log in with this column.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text NOT NULL DEFAULT '';
