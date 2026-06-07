-- Migration 0076: Enterprise object versioning for publish lifecycle parity
-- Adds version tables for all enterprise routing and policy objects.
-- Follows the flow_versions pattern established in 0001_initial_schema.sql.
-- Issues: #319 (publish lifecycle parity), #320 (audit/approval parity), #321 (rollback/versioning)

-- ── Trunk group versions ─────────────────────────────────────────────────────

CREATE TABLE trunk_group_versions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trunk_group_id uuid       NOT NULL REFERENCES trunk_groups(id) ON DELETE CASCADE,
  version_number integer    NOT NULL,
  state         text        NOT NULL DEFAULT 'draft'
                CHECK (state IN ('draft','validated','simulated','published','superseded','rolled_back')),
  definition    jsonb       NOT NULL DEFAULT '{}',
  created_by    uuid        REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  validated_at  timestamptz,
  simulated_at  timestamptz,
  published_at  timestamptz,
  metadata      jsonb       NOT NULL DEFAULT '{}',
  UNIQUE (trunk_group_id, version_number)
);

CREATE INDEX idx_trunk_group_versions_group  ON trunk_group_versions (trunk_group_id);
CREATE INDEX idx_trunk_group_versions_tenant ON trunk_group_versions (tenant_id);
CREATE INDEX idx_trunk_group_versions_state  ON trunk_group_versions (trunk_group_id, state);

ALTER TABLE trunk_groups ADD COLUMN draft_version_id  uuid REFERENCES trunk_group_versions(id);
ALTER TABLE trunk_groups ADD COLUMN active_version_id uuid REFERENCES trunk_group_versions(id);

-- ── Numbering plan versions ──────────────────────────────────────────────────

CREATE TABLE numbering_plan_versions (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numbering_plan_id  uuid        NOT NULL REFERENCES numbering_plans(id) ON DELETE CASCADE,
  version_number     integer     NOT NULL,
  state              text        NOT NULL DEFAULT 'draft'
                     CHECK (state IN ('draft','validated','simulated','published','superseded','rolled_back')),
  definition         jsonb       NOT NULL DEFAULT '{}',
  created_by         uuid        REFERENCES users(id),
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  validated_at       timestamptz,
  simulated_at       timestamptz,
  published_at       timestamptz,
  metadata           jsonb       NOT NULL DEFAULT '{}',
  UNIQUE (numbering_plan_id, version_number)
);

CREATE INDEX idx_numbering_plan_versions_plan   ON numbering_plan_versions (numbering_plan_id);
CREATE INDEX idx_numbering_plan_versions_tenant ON numbering_plan_versions (tenant_id);
CREATE INDEX idx_numbering_plan_versions_state  ON numbering_plan_versions (numbering_plan_id, state);

ALTER TABLE numbering_plans ADD COLUMN draft_version_id  uuid REFERENCES numbering_plan_versions(id);
ALTER TABLE numbering_plans ADD COLUMN active_version_id uuid REFERENCES numbering_plan_versions(id);

-- ── Calling policy versions ──────────────────────────────────────────────────

CREATE TABLE calling_policy_versions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  calling_policy_id   uuid        NOT NULL REFERENCES calling_policies(id) ON DELETE CASCADE,
  version_number      integer     NOT NULL,
  state               text        NOT NULL DEFAULT 'draft'
                      CHECK (state IN ('draft','validated','simulated','published','superseded','rolled_back')),
  definition          jsonb       NOT NULL DEFAULT '{}',
  created_by          uuid        REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT NOW(),
  validated_at        timestamptz,
  simulated_at        timestamptz,
  published_at        timestamptz,
  metadata            jsonb       NOT NULL DEFAULT '{}',
  UNIQUE (calling_policy_id, version_number)
);

CREATE INDEX idx_calling_policy_versions_policy ON calling_policy_versions (calling_policy_id);
CREATE INDEX idx_calling_policy_versions_tenant ON calling_policy_versions (tenant_id);
CREATE INDEX idx_calling_policy_versions_state  ON calling_policy_versions (calling_policy_id, state);

ALTER TABLE calling_policies ADD COLUMN draft_version_id  uuid REFERENCES calling_policy_versions(id);
ALTER TABLE calling_policies ADD COLUMN active_version_id uuid REFERENCES calling_policy_versions(id);

-- ── Site versions ────────────────────────────────────────────────────────────

CREATE TABLE site_versions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id        uuid        NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  version_number integer     NOT NULL,
  state          text        NOT NULL DEFAULT 'draft'
                 CHECK (state IN ('draft','validated','simulated','published','superseded','rolled_back')),
  definition     jsonb       NOT NULL DEFAULT '{}',
  created_by     uuid        REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  validated_at   timestamptz,
  simulated_at   timestamptz,
  published_at   timestamptz,
  metadata       jsonb       NOT NULL DEFAULT '{}',
  UNIQUE (site_id, version_number)
);

CREATE INDEX idx_site_versions_site   ON site_versions (site_id);
CREATE INDEX idx_site_versions_tenant ON site_versions (tenant_id);
CREATE INDEX idx_site_versions_state  ON site_versions (site_id, state);

ALTER TABLE sites ADD COLUMN draft_version_id  uuid REFERENCES site_versions(id);
ALTER TABLE sites ADD COLUMN active_version_id uuid REFERENCES site_versions(id);

-- ── Schedule versions ────────────────────────────────────────────────────────

CREATE TABLE schedule_versions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  schedule_id    uuid        NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  version_number integer     NOT NULL,
  state          text        NOT NULL DEFAULT 'draft'
                 CHECK (state IN ('draft','validated','simulated','published','superseded','rolled_back')),
  definition     jsonb       NOT NULL DEFAULT '{}',
  created_by     uuid        REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  validated_at   timestamptz,
  simulated_at   timestamptz,
  published_at   timestamptz,
  metadata       jsonb       NOT NULL DEFAULT '{}',
  UNIQUE (schedule_id, version_number)
);

CREATE INDEX idx_schedule_versions_schedule ON schedule_versions (schedule_id);
CREATE INDEX idx_schedule_versions_tenant   ON schedule_versions (tenant_id);
CREATE INDEX idx_schedule_versions_state    ON schedule_versions (schedule_id, state);

ALTER TABLE schedules ADD COLUMN draft_version_id  uuid REFERENCES schedule_versions(id);
ALTER TABLE schedules ADD COLUMN active_version_id uuid REFERENCES schedule_versions(id);

-- ── Line appearance versions ─────────────────────────────────────────────────

CREATE TABLE line_appearance_versions (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  line_appearance_id   uuid        NOT NULL REFERENCES line_appearances(id) ON DELETE CASCADE,
  version_number       integer     NOT NULL,
  state                text        NOT NULL DEFAULT 'draft'
                       CHECK (state IN ('draft','validated','simulated','published','superseded','rolled_back')),
  definition           jsonb       NOT NULL DEFAULT '{}',
  created_by           uuid        REFERENCES users(id),
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  validated_at         timestamptz,
  simulated_at         timestamptz,
  published_at         timestamptz,
  metadata             jsonb       NOT NULL DEFAULT '{}',
  UNIQUE (line_appearance_id, version_number)
);

CREATE INDEX idx_line_appearance_versions_la     ON line_appearance_versions (line_appearance_id);
CREATE INDEX idx_line_appearance_versions_tenant ON line_appearance_versions (tenant_id);
CREATE INDEX idx_line_appearance_versions_state  ON line_appearance_versions (line_appearance_id, state);

ALTER TABLE line_appearances ADD COLUMN draft_version_id  uuid REFERENCES line_appearance_versions(id);
ALTER TABLE line_appearances ADD COLUMN active_version_id uuid REFERENCES line_appearance_versions(id);
