-- User-extension-device separation (#308)
-- Devices are first-class objects holding SIP credentials independently from extensions.
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'other'
    CHECK (device_type IN ('softphone', 'desk_phone', 'webrtc', 'mobile', 'other')),
  mac_address TEXT,
  sip_username TEXT,
  sip_password_ciphertext TEXT,
  sip_password_key_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'deprovisioned')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX ON devices (tenant_id, status);

-- Credential and registration ownership alignment (#309)
-- Tracks active SIP registrations per device / extension.
CREATE TABLE device_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  extension_id UUID REFERENCES extensions(id) ON DELETE SET NULL,
  sip_username TEXT NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  contact_uri TEXT,
  user_agent TEXT,
  source_ip TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX ON device_registrations (tenant_id, device_id, is_active);
CREATE INDEX ON device_registrations (tenant_id, extension_id, is_active);

-- Extension-device assignment workflows (#310)
-- Assigns users or devices to extensions as first-class relationships.
CREATE TABLE extension_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  extension_id UUID NOT NULL REFERENCES extensions(id) ON DELETE CASCADE,
  assignable_type TEXT NOT NULL CHECK (assignable_type IN ('user', 'device')),
  assignable_id UUID NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, extension_id, assignable_type, assignable_id)
);

CREATE INDEX ON extension_assignments (tenant_id, extension_id);
CREATE INDEX ON extension_assignments (tenant_id, assignable_type, assignable_id);
