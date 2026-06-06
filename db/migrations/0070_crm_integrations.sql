-- CRM screen-pop integrations (#281)
-- Tenant-scoped CRM integration definitions and lookup audit log.

CREATE TABLE crm_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL
    CHECK (provider IN ('salesforce', 'hubspot', 'zoho', 'dynamics365', 'generic_webhook')),
  -- Endpoint is the CRM lookup URL template. Use {caller_id} as the substitution token.
  lookup_url_template TEXT NOT NULL,
  -- Opaque credentials blob (API key, OAuth token, etc.), stored encrypted at rest.
  credentials_encrypted TEXT,
  -- Screen-pop payload template: JSON template with {caller_id}, {crm_contact}, etc.
  payload_template JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX ON crm_integrations (tenant_id, provider, status);

-- CRM lookup log: immutable audit record of each screen-pop attempt.
CREATE TABLE crm_lookup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  crm_integration_id UUID NOT NULL REFERENCES crm_integrations(id) ON DELETE CASCADE,
  call_uuid TEXT NOT NULL,
  caller_id TEXT NOT NULL,
  -- outcome: 'found', 'not_found', 'error'
  outcome TEXT NOT NULL
    CHECK (outcome IN ('found', 'not_found', 'error')),
  -- Redacted summary of the CRM response (no PII stored inline).
  response_summary TEXT,
  error_detail TEXT,
  looked_up_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON crm_lookup_log (tenant_id, crm_integration_id, looked_up_at DESC);
CREATE INDEX ON crm_lookup_log (tenant_id, call_uuid);
