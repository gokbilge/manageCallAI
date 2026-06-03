-- SLICE-64: Link extensions to their owner user for self-service portal
--
-- Adds owner_user_id so the /me/* self-service endpoints can find
-- the requesting user's extension without requiring a separate join table.
-- Nullable: existing extensions before self-service have no linked user.

ALTER TABLE extensions
    ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_extensions_owner_user
    ON extensions (owner_user_id)
    WHERE owner_user_id IS NOT NULL;

COMMENT ON COLUMN extensions.owner_user_id IS
    'User who owns this extension for self-service portal lookups. '
    'Set when an extension is created or assigned to a user account.';
