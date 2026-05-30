ALTER TABLE channel_message_requests
  ADD COLUMN IF NOT EXISTS processor_id text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_id text;

ALTER TABLE channel_message_requests
  DROP CONSTRAINT IF EXISTS channel_message_requests_status_check;

ALTER TABLE channel_message_requests
  ADD CONSTRAINT channel_message_requests_status_check
  CHECK (status IN ('queued', 'processing', 'sent', 'failed'));
