-- AI route and fraud-policy recommendations (#258)
CREATE TABLE ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('inbound_route', 'outbound_route', 'fraud_policy')),
  target_id UUID,
  intent TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  recommendation JSONB,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  rationale TEXT,
  blast_radius TEXT,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  decided_by UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON ai_recommendations (tenant_id, target_type, target_id, created_at DESC);
CREATE INDEX ON ai_recommendations (tenant_id, status, created_at DESC);

-- Incident investigation sessions (#259)
CREATE TABLE incident_investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  context_json JSONB NOT NULL DEFAULT '{}',
  answer TEXT,
  citations JSONB NOT NULL DEFAULT '[]',
  data_sources TEXT[] NOT NULL DEFAULT '{}',
  is_advisory BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON incident_investigations (tenant_id, created_at DESC);
