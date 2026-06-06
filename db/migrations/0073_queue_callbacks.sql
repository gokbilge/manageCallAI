-- Queue callback request lifecycle (#276)
-- Tenant-scoped callback requests for queued callers with scheduling and retry.

CREATE TABLE queue_callbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  queue_id UUID NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
  caller_phone TEXT NOT NULL,
  caller_name TEXT,
  -- scheduled_at: optional future time the callback should be attempted
  scheduled_at TIMESTAMPTZ,
  -- retry_count: incremented each time the callback is retried from 'calling' → 'pending'
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3
    CHECK (max_retries >= 0 AND max_retries <= 10),
  -- status lifecycle: pending → scheduled | calling → reached | cancelled | expired
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'scheduled', 'calling', 'reached', 'cancelled', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON queue_callbacks (tenant_id, status);
CREATE INDEX ON queue_callbacks (tenant_id, queue_id);
CREATE INDEX ON queue_callbacks (tenant_id, scheduled_at) WHERE status IN ('pending', 'scheduled');
