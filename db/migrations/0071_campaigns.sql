-- Campaign management baseline (#282)
-- Tenant-scoped campaign objects with lifecycle, contact lists, and agent assignments.

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  -- type: outbound_preview (agent previews contact before dialing), outbound_progressive (auto-paced)
  campaign_type TEXT NOT NULL DEFAULT 'outbound_preview'
    CHECK (campaign_type IN ('outbound_preview', 'outbound_progressive')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
  -- outbound_route_id is optional; if set, outbound calls must use this route.
  -- This enforces that campaign dialing respects outbound policy and fraud controls.
  outbound_route_id UUID REFERENCES outbound_routes(id) ON DELETE SET NULL,
  -- Max simultaneous outbound calls for this campaign.
  max_concurrent_calls INTEGER NOT NULL DEFAULT 1
    CHECK (max_concurrent_calls >= 1 AND max_concurrent_calls <= 50),
  -- ISO 8601 schedule window: calls only placed in this window.
  schedule_start_time TIME,
  schedule_end_time TIME,
  schedule_timezone TEXT NOT NULL DEFAULT 'UTC',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON campaigns (tenant_id, status);

-- Campaign contacts: the list of numbers to dial for a campaign.
CREATE TABLE campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  display_name TEXT,
  -- context: arbitrary JSON for CRM screen-pop or agent preview
  context JSONB NOT NULL DEFAULT '{}',
  -- dial_state: 'pending', 'dialing', 'reached', 'no_answer', 'failed', 'skipped'
  dial_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (dial_state IN ('pending', 'dialing', 'reached', 'no_answer', 'failed', 'skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, campaign_id, phone_number)
);

CREATE INDEX ON campaign_contacts (tenant_id, campaign_id, dial_state);

-- Campaign agent assignments: which agents are assigned to a campaign.
CREATE TABLE campaign_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  agent_profile_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, campaign_id, agent_profile_id)
);

CREATE INDEX ON campaign_assignments (tenant_id, campaign_id);
CREATE INDEX ON campaign_assignments (tenant_id, agent_profile_id);
