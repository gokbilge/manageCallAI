-- Unified numbering plan model (#300)
CREATE TABLE numbering_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  country_code TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE numbering_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES numbering_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pattern TEXT NOT NULL,
  call_type TEXT NOT NULL CHECK (call_type IN (
    'local', 'national', 'mobile', 'international',
    'premium_rate', 'emergency', 'toll_free', 'special'
  )),
  priority INTEGER NOT NULL DEFAULT 100,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE numbering_plan_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES numbering_plans(id) ON DELETE CASCADE,
  assignable_type TEXT NOT NULL CHECK (assignable_type IN ('extension', 'sip_trunk', 'tenant')),
  assignable_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, assignable_type, COALESCE(assignable_id, '00000000-0000-0000-0000-000000000000'))
);

CREATE INDEX ON numbering_plans (tenant_id, status);
CREATE INDEX ON numbering_rules (tenant_id, plan_id, priority);
CREATE INDEX ON numbering_plan_assignments (tenant_id, assignable_type, assignable_id);

-- Calling policy and outbound permission model (#301)
CREATE TABLE calling_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  allow_local BOOLEAN NOT NULL DEFAULT true,
  allow_national BOOLEAN NOT NULL DEFAULT true,
  allow_mobile BOOLEAN NOT NULL DEFAULT true,
  allow_international BOOLEAN NOT NULL DEFAULT false,
  allow_premium_rate BOOLEAN NOT NULL DEFAULT false,
  allow_toll_free BOOLEAN NOT NULL DEFAULT true,
  allow_special BOOLEAN NOT NULL DEFAULT false,
  emergency_always_allowed BOOLEAN NOT NULL DEFAULT true,
  exceptions JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE calling_policy_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES calling_policies(id) ON DELETE CASCADE,
  assignable_type TEXT NOT NULL CHECK (assignable_type IN ('extension', 'call_group', 'tenant')),
  assignable_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, assignable_type, COALESCE(assignable_id, '00000000-0000-0000-0000-000000000000'))
);

CREATE INDEX ON calling_policies (tenant_id, status);
CREATE INDEX ON calling_policy_assignments (tenant_id, assignable_type, assignable_id);
