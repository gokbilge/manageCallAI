-- Contact-center supervisor analytics, dispositions, and QA workflow
-- Covers:
-- #277 SLA tracking and queue wallboards
-- #278 disposition codes and post-call notes
-- #279 QA scoring workflow

CREATE TABLE queue_sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  queue_id UUID NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
  answer_target_seconds INTEGER NOT NULL DEFAULT 20 CHECK (answer_target_seconds BETWEEN 1 AND 3600),
  answer_rate_target_percent INTEGER NOT NULL DEFAULT 80 CHECK (answer_rate_target_percent BETWEEN 1 AND 100),
  abandonment_threshold_percent INTEGER NOT NULL DEFAULT 10 CHECK (abandonment_threshold_percent BETWEEN 0 AND 100),
  wallboard_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, queue_id)
);

CREATE INDEX idx_queue_sla_policies_tenant_queue ON queue_sla_policies (tenant_id, queue_id);

CREATE TABLE call_disposition_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  queue_id UUID NULL REFERENCES queues(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_call_disposition_codes_tenant_status
  ON call_disposition_codes (tenant_id, status, sort_order, created_at DESC);
CREATE INDEX idx_call_disposition_codes_tenant_queue
  ON call_disposition_codes (tenant_id, queue_id, sort_order, created_at DESC);

CREATE TABLE call_dispositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id TEXT NOT NULL,
  queue_id UUID NULL REFERENCES queues(id) ON DELETE SET NULL,
  agent_profile_id UUID NULL REFERENCES agent_profiles(id) ON DELETE SET NULL,
  disposition_code_id UUID NULL REFERENCES call_disposition_codes(id) ON DELETE SET NULL,
  disposition_code TEXT NULL,
  disposition_label TEXT NULL,
  note_text TEXT NULL,
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, call_id)
);

CREATE INDEX idx_call_dispositions_tenant_queue_created
  ON call_dispositions (tenant_id, queue_id, created_at DESC);
CREATE INDEX idx_call_dispositions_tenant_agent_created
  ON call_dispositions (tenant_id, agent_profile_id, created_at DESC);

CREATE TABLE qa_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  criteria_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qa_scorecards_tenant_status
  ON qa_scorecards (tenant_id, status, created_at DESC);

CREATE TABLE qa_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id TEXT NOT NULL,
  queue_id UUID NULL REFERENCES queues(id) ON DELETE SET NULL,
  agent_profile_id UUID NULL REFERENCES agent_profiles(id) ON DELETE SET NULL,
  recording_id UUID NULL REFERENCES call_recordings(id) ON DELETE SET NULL,
  disposition_id UUID NULL REFERENCES call_dispositions(id) ON DELETE SET NULL,
  scorecard_id UUID NOT NULL REFERENCES qa_scorecards(id) ON DELETE RESTRICT,
  reviewer_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'acknowledged')),
  scores_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  note_text TEXT NULL,
  total_score INTEGER NOT NULL DEFAULT 0 CHECK (total_score >= 0),
  max_score INTEGER NOT NULL DEFAULT 0 CHECK (max_score >= 0),
  completed_at TIMESTAMPTZ NULL,
  acknowledged_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qa_reviews_tenant_status_created
  ON qa_reviews (tenant_id, status, created_at DESC);
CREATE INDEX idx_qa_reviews_tenant_call_created
  ON qa_reviews (tenant_id, call_id, created_at DESC);
CREATE INDEX idx_qa_reviews_tenant_agent_created
  ON qa_reviews (tenant_id, agent_profile_id, created_at DESC);
