-- Disposition codes and post-call notes (#278)
-- Tenant-scoped disposition catalog, per-call disposition capture, and call notes.

-- disposition_codes: tenant-scoped catalog of disposition values.
-- An optional queue_id scopes the code to a specific queue; NULL means global.
CREATE TABLE disposition_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  queue_id UUID REFERENCES queues(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX ON disposition_codes (tenant_id, is_active);
CREATE INDEX ON disposition_codes (tenant_id, queue_id);

-- call_dispositions: one disposition per call per tenant, recorded by agent after wrap-up.
CREATE TABLE call_dispositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id TEXT NOT NULL,
  disposition_code_id UUID NOT NULL REFERENCES disposition_codes(id),
  agent_profile_id UUID REFERENCES agent_profiles(id) ON DELETE SET NULL,
  recorded_by UUID NOT NULL REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, call_id)
);

CREATE INDEX ON call_dispositions (tenant_id, call_id);
CREATE INDEX ON call_dispositions (tenant_id, agent_profile_id);
CREATE INDEX ON call_dispositions (tenant_id, disposition_code_id);

-- call_notes: free-text notes attached to a call (multiple per call allowed).
CREATE TABLE call_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id TEXT NOT NULL,
  author_user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON call_notes (tenant_id, call_id);
CREATE INDEX ON call_notes (tenant_id, author_user_id);
