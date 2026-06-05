-- SLICE-65: Extend self-service policy for device visibility and SIP reset
--
-- Adds tenant-level gates for the end-user device surface and one-time
-- self-service SIP credential reset.

ALTER TABLE end_user_self_service_policies
    ADD COLUMN IF NOT EXISTS device_view boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS sip_credential_reset boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN end_user_self_service_policies.device_view IS
    'Allow end users to view their own SIP registration/device status.';

COMMENT ON COLUMN end_user_self_service_policies.sip_credential_reset IS
    'Allow end users to rotate their own SIP credential from the self-service portal.';

CREATE TABLE IF NOT EXISTS extension_registrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    extension_id uuid REFERENCES extensions(id) ON DELETE SET NULL,
    extension_number text NOT NULL,
    status text NOT NULL CHECK (status IN ('registered', 'expired', 'unregistered')),
    contact_domain text,
    user_agent text,
    registered_at timestamptz,
    last_seen_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, extension_number)
);

CREATE INDEX IF NOT EXISTS extension_registrations_tenant_status
    ON extension_registrations (tenant_id, status, updated_at DESC);
