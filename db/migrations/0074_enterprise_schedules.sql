CREATE TABLE IF NOT EXISTS schedule_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    weekly_rules_json jsonb NOT NULL DEFAULT '[]',
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_groups_tenant_name
    ON schedule_groups (tenant_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_schedule_groups_tenant_status
    ON schedule_groups (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS holiday_calendars (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    entries_json jsonb NOT NULL DEFAULT '[]',
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_holiday_calendars_tenant_name
    ON holiday_calendars (tenant_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_holiday_calendars_tenant_status
    ON holiday_calendars (tenant_id, status, created_at DESC);

ALTER TABLE schedules
    ADD COLUMN IF NOT EXISTS schedule_group_id uuid REFERENCES schedule_groups(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS holiday_calendar_id uuid REFERENCES holiday_calendars(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schedules_tenant_group
    ON schedules (tenant_id, schedule_group_id)
    WHERE schedule_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_schedules_tenant_calendar
    ON schedules (tenant_id, holiday_calendar_id)
    WHERE holiday_calendar_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS schedule_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    name text NOT NULL,
    reason text,
    mode text NOT NULL CHECK (mode IN ('closed', 'custom_hours')),
    open_time text,
    close_time text,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    cancelled_at timestamptz,
    cancelled_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    CHECK (ends_at > starts_at),
    CHECK (
        (mode = 'closed' AND open_time IS NULL AND close_time IS NULL)
        OR
        (mode = 'custom_hours' AND open_time IS NOT NULL AND close_time IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_schedule_overrides_tenant_schedule
    ON schedule_overrides (tenant_id, schedule_id, starts_at DESC);

CREATE INDEX IF NOT EXISTS idx_schedule_overrides_active_window
    ON schedule_overrides (tenant_id, schedule_id, starts_at, ends_at)
    WHERE cancelled_at IS NULL;
