-- SLICE-60: Tenant-scoped feature codes
--
-- Defines DTMF feature codes (e.g. *72 = enable call forward) as desired-state
-- objects in PostgreSQL. Active codes are projected into the FreeSWITCH dialplan
-- via mod_xml_curl. Lua thin executor calls back to the API runtime endpoint.

CREATE TABLE IF NOT EXISTS feature_codes (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code                text NOT NULL,                -- e.g. '*72', '#1', '700'
    name                text NOT NULL,
    description         text,
    action_type         text NOT NULL CHECK (action_type IN (
                            'voicemail_access',
                            'call_forward_enable',
                            'call_forward_disable',
                            'dnd_enable',
                            'dnd_disable',
                            'call_pickup',
                            'call_park',
                            'call_park_retrieve',
                            'conference_join'
                        )),
    action_config       jsonb NOT NULL DEFAULT '{}',
    status              text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'disabled')),
    requires_approval   boolean NOT NULL DEFAULT false,
    created_by          uuid,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    published_at        timestamptz,
    -- code must be unique within a tenant
    UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_feature_codes_tenant_status
    ON feature_codes (tenant_id, status);

COMMENT ON TABLE feature_codes IS
    'Tenant-scoped DTMF feature code definitions. Active codes are served to '
    'FreeSWITCH via mod_xml_curl and executed through a Lua thin executor that '
    'calls back to the API runtime endpoint.';

COMMENT ON COLUMN feature_codes.code IS
    'DTMF code dialed by the caller, e.g. *72 or 700. Unique per tenant.';

COMMENT ON COLUMN feature_codes.action_type IS
    'Safe action type enum. No arbitrary actions are permitted.';
