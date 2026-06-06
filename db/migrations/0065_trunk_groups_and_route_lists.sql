-- Trunk-group and route-list model (#305)

CREATE TABLE trunk_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  selection_strategy TEXT NOT NULL DEFAULT 'priority'
    CHECK (selection_strategy IN ('priority', 'round_robin', 'weight')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE trunk_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trunk_group_id UUID NOT NULL REFERENCES trunk_groups(id) ON DELETE CASCADE,
  trunk_id UUID NOT NULL REFERENCES sip_trunks(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 100,
  weight INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trunk_group_id, trunk_id)
);

CREATE TABLE route_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE route_list_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  route_list_id UUID NOT NULL REFERENCES route_lists(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('sip_trunk', 'trunk_group', 'outbound_route')),
  entry_id UUID NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (route_list_id, entry_type, entry_id)
);

CREATE INDEX ON trunk_groups (tenant_id, status);
CREATE INDEX ON trunk_group_members (tenant_id, trunk_group_id, priority);
CREATE INDEX ON route_lists (tenant_id, status);
CREATE INDEX ON route_list_entries (tenant_id, route_list_id, priority);
