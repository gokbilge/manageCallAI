-- Line appearance domain model (#314)
-- A line_appearance represents a named slot for an extension appearing on device buttons.
-- This is the foundation for shared-line and button-layout features.
CREATE TABLE line_appearances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  extension_id UUID NOT NULL REFERENCES extensions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  appearance_index INTEGER NOT NULL DEFAULT 0
    CHECK (appearance_index >= 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, extension_id, appearance_index)
);

CREATE INDEX ON line_appearances (tenant_id, extension_id, status);

-- Device appearance assignment foundation (#315)
-- Assigns a line_appearance to a specific button position on a device.
CREATE TABLE device_appearance_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  line_appearance_id UUID NOT NULL REFERENCES line_appearances(id) ON DELETE CASCADE,
  button_index INTEGER NOT NULL CHECK (button_index >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, device_id, button_index),
  UNIQUE (tenant_id, device_id, line_appearance_id)
);

CREATE INDEX ON device_appearance_assignments (tenant_id, device_id);
CREATE INDEX ON device_appearance_assignments (tenant_id, line_appearance_id);
