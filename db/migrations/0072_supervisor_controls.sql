-- Supervisor monitor/whisper/barge controls (#275)
-- Tenant-scoped supervisor control sessions with lifecycle and audit trail.

CREATE TABLE supervisor_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- supervisor_user_id: the user initiating the control session
  supervisor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- control_type: 'monitor' (silent listen), 'whisper' (agent-only audio), 'barge' (full join)
  control_type TEXT NOT NULL
    CHECK (control_type IN ('monitor', 'whisper', 'barge')),
  -- target_call_id: the call/channel identifier being supervised (runtime reference)
  target_call_id TEXT NOT NULL,
  -- status lifecycle: pending → active → ended
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'ended')),
  audit_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX ON supervisor_controls (tenant_id, status);
CREATE INDEX ON supervisor_controls (tenant_id, supervisor_user_id);
