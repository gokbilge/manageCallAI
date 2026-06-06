-- Skills-based routing (#273)
-- Skill definitions, agent skill assignments, queue skill requirements,
-- and a routing evaluation log for deterministic, auditable routing decisions.

CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX ON skills (tenant_id, status);

-- Agent skill assignments: which agents hold which skills and at what proficiency.
-- Proficiency 1 (novice) to 5 (expert).
CREATE TABLE agent_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_profile_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  proficiency INTEGER NOT NULL DEFAULT 1
    CHECK (proficiency BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, agent_profile_id, skill_id)
);

CREATE INDEX ON agent_skills (tenant_id, skill_id);
CREATE INDEX ON agent_skills (tenant_id, agent_profile_id);

-- Queue skill requirements: skills a queue demands, with a minimum proficiency.
CREATE TABLE queue_skill_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  queue_id UUID NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  min_proficiency INTEGER NOT NULL DEFAULT 1
    CHECK (min_proficiency BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, queue_id, skill_id)
);

CREATE INDEX ON queue_skill_requirements (tenant_id, queue_id);

-- Routing evaluation log: immutable, auditable record of routing eligibility decisions.
CREATE TABLE routing_evaluation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  queue_id UUID NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
  agent_profile_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
  eligible BOOLEAN NOT NULL,
  reason TEXT NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON routing_evaluation_log (tenant_id, queue_id, evaluated_at DESC);
CREATE INDEX ON routing_evaluation_log (tenant_id, agent_profile_id, evaluated_at DESC);
