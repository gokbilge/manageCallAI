-- Agent workspace baseline (#271) and agent availability model (#272)
-- Adds 'agent' role, agent profiles, and explicit availability states.

-- Extend the role check to include the new 'agent' role.
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
    CHECK (role IN ('tenant_admin', 'tenant_operator', 'tenant_viewer', 'end_user', 'agent'));

-- Agent profiles: contact-center workspace configuration for each agent.
-- One profile per user per tenant; user must exist in the tenant.
CREATE TABLE agent_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  max_concurrent_calls INTEGER NOT NULL DEFAULT 1
    CHECK (max_concurrent_calls >= 1 AND max_concurrent_calls <= 10),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX ON agent_profiles (tenant_id, status);

-- Agent availability: explicit state for each agent, queryable by queue routing.
-- One availability record per agent profile; upserted on state transitions.
CREATE TABLE agent_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_profile_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'offline'
    CHECK (state IN ('available', 'busy', 'away', 'wrap_up', 'offline')),
  reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, agent_profile_id)
);

CREATE INDEX ON agent_availability (tenant_id, state);
