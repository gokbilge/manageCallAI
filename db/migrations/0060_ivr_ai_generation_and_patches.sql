-- IVR AI generation requests (#253): natural-language intent → queued work → draft graph
CREATE TABLE ivr_generation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  flow_id UUID REFERENCES ivr_flows(id) ON DELETE SET NULL,
  version_id UUID,
  intent TEXT NOT NULL,
  flow_name TEXT NOT NULL,
  provider_hint TEXT NOT NULL DEFAULT 'auto',
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  processor_id TEXT,
  claimed_at TIMESTAMPTZ,
  generated_graph JSONB,
  error_message TEXT,
  provider_metadata JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX ON ivr_generation_requests (tenant_id, created_at DESC);
CREATE INDEX ON ivr_generation_requests (status) WHERE status IN ('queued', 'processing');

-- IVR AI patch requests (#254): AI-generated structured diffs for IVR drafts and route drafts
CREATE TABLE ivr_ai_patch_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('ivr_flow', 'inbound_route')),
  target_id UUID NOT NULL,
  version_id UUID,
  intent TEXT NOT NULL,
  provider_hint TEXT NOT NULL DEFAULT 'auto',
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'accepted', 'rejected', 'failed')),
  processor_id TEXT,
  claimed_at TIMESTAMPTZ,
  diff_json JSONB,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  risk_summary TEXT,
  blast_radius_hint TEXT,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  decided_by UUID,
  error_message TEXT,
  provider_metadata JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX ON ivr_ai_patch_requests (tenant_id, target_type, target_id, created_at DESC);
CREATE INDEX ON ivr_ai_patch_requests (status) WHERE status IN ('queued', 'processing');
