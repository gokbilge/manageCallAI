ALTER TABLE outbound_call_requests
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

ALTER TABLE outbound_call_requests
  DROP CONSTRAINT IF EXISTS outbound_call_requests_status_check;

ALTER TABLE outbound_call_requests
  ADD CONSTRAINT outbound_call_requests_status_check
    CHECK (status IN ('pending', 'dispatched', 'answered', 'completed', 'failed', 'expired'));
