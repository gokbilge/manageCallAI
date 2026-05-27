-- Track consecutive delivery failures and auto-disable after threshold.
ALTER TABLE automation_webhooks
  ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disabled_at   TIMESTAMPTZ;
