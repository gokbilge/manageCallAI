ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS directory_domain text;

UPDATE tenants
SET directory_domain = slug || '.managecallai.local'
WHERE directory_domain IS NULL OR directory_domain = '';

ALTER TABLE tenants
  ALTER COLUMN directory_domain SET NOT NULL;

ALTER TABLE tenants
  ADD CONSTRAINT tenants_directory_domain_key UNIQUE (directory_domain);

ALTER TABLE extensions
  ADD COLUMN IF NOT EXISTS sip_username text,
  ADD COLUMN IF NOT EXISTS sip_password text;

UPDATE extensions
SET
  sip_username = COALESCE(NULLIF(sip_username, ''), extension_number),
  sip_password = COALESCE(NULLIF(sip_password, ''), 'ChangeMe-' || substring(id::text, 1, 8))
WHERE sip_username IS NULL
   OR sip_username = ''
   OR sip_password IS NULL
   OR sip_password = '';

ALTER TABLE extensions
  ALTER COLUMN sip_username SET NOT NULL,
  ALTER COLUMN sip_password SET NOT NULL;

ALTER TABLE extensions
  ADD CONSTRAINT extensions_tenant_sip_username_key UNIQUE (tenant_id, sip_username);
