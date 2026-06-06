-- Site and location domain model (#303) with emergency/dialing defaults (#304)
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state_region TEXT,
  postal_code TEXT,
  country_code TEXT,
  timezone TEXT,
  language_code TEXT,
  network_zone TEXT,
  -- Site-aware emergency defaults (#304)
  emergency_number TEXT NOT NULL DEFAULT '911',
  emergency_outbound_route_id UUID REFERENCES outbound_routes(id) ON DELETE SET NULL,
  -- Site dialing defaults (#304)
  default_calling_policy_id UUID REFERENCES calling_policies(id) ON DELETE SET NULL,
  default_numbering_plan_id UUID REFERENCES numbering_plans(id) ON DELETE SET NULL,
  default_outbound_route_id UUID REFERENCES outbound_routes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE site_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  floor TEXT,
  room TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, site_id, name)
);

CREATE INDEX ON sites (tenant_id, status);
CREATE INDEX ON site_locations (tenant_id, site_id);
