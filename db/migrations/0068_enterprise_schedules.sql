ALTER TABLE schedules
    ADD COLUMN IF NOT EXISTS description text;

CREATE TABLE IF NOT EXISTS holiday_calendars (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    entries_json jsonb NOT NULL DEFAULT '[]',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holiday_calendars_schedule
    ON holiday_calendars (tenant_id, schedule_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS schedule_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    name text NOT NULL,
    reason text,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'cancelled')),
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    closed boolean NOT NULL,
    open_time text,
    close_time text,
    cancelled_at timestamptz,
    cancelled_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_schedule_overrides_schedule
    ON schedule_overrides (tenant_id, schedule_id, status, starts_at DESC);
