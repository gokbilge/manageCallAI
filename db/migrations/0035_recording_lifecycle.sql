-- Call recording storage lifecycle.
--
-- Adds retention policy fields to call_recordings so the storage worker knows
-- when to delete or archive media files.

ALTER TABLE call_recordings
    ADD COLUMN IF NOT EXISTS retain_until    timestamptz,
    ADD COLUMN IF NOT EXISTS archived_at     timestamptz,
    ADD COLUMN IF NOT EXISTS archive_path    text,
    ADD COLUMN IF NOT EXISTS deleted_at      timestamptz,
    ADD COLUMN IF NOT EXISTS delete_reason   text;

-- A recording is "due for purge" when retain_until has passed and it is not yet deleted.
CREATE INDEX IF NOT EXISTS call_recordings_purge_due
    ON call_recordings (retain_until ASC)
    WHERE retain_until IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN call_recordings.retain_until IS
    'UTC timestamp after which the recording media file may be purged. '
    'NULL = indefinite retention. Set at ingest time from tenant retention policy.';
