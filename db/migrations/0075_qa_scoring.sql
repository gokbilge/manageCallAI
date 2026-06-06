-- QA scoring workflow (#279)
-- Manual QA scorecards, criteria, review lifecycle, and per-criterion scores.

-- qa_scorecard_templates: tenant-scoped reusable scorecard definitions.
CREATE TABLE qa_scorecard_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON qa_scorecard_templates (tenant_id, is_active);

-- qa_scorecard_criteria: weighted scoring criteria belonging to a template.
CREATE TABLE qa_scorecard_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES qa_scorecard_templates(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  max_score INTEGER NOT NULL DEFAULT 10 CHECK (max_score >= 1),
  weight NUMERIC(5,2) NOT NULL DEFAULT 1.0 CHECK (weight > 0),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON qa_scorecard_criteria (tenant_id, template_id, display_order);

-- qa_reviews: a supervisor's QA evaluation of a specific call.
-- Lifecycle: draft → submitted → disputed | finalized
CREATE TABLE qa_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES qa_scorecard_templates(id),
  call_id TEXT NOT NULL,
  recording_id UUID REFERENCES call_recordings(id) ON DELETE SET NULL,
  reviewer_user_id UUID NOT NULL REFERENCES users(id),
  agent_profile_id UUID REFERENCES agent_profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'disputed', 'finalized')),
  -- overall_score: computed weighted average, stored on submit/finalize
  overall_score NUMERIC(5,2),
  notes TEXT,
  disputed_by UUID REFERENCES users(id),
  disputed_at TIMESTAMPTZ,
  dispute_reason TEXT,
  finalized_by UUID REFERENCES users(id),
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON qa_reviews (tenant_id, status);
CREATE INDEX ON qa_reviews (tenant_id, call_id);
CREATE INDEX ON qa_reviews (tenant_id, reviewer_user_id);
CREATE INDEX ON qa_reviews (tenant_id, agent_profile_id);

-- qa_review_scores: one score row per criterion per review.
CREATE TABLE qa_review_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  review_id UUID NOT NULL REFERENCES qa_reviews(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES qa_scorecard_criteria(id),
  score INTEGER NOT NULL CHECK (score >= 0),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (review_id, criterion_id)
);

CREATE INDEX ON qa_review_scores (tenant_id, review_id);
