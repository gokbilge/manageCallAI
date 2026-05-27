-- Expose SIP trunk network and authentication fields as first-class columns.
-- The original schema stored these in authentication_profile/network_profile jsonb;
-- explicit columns let the API expose them cleanly without jsonb parsing.

ALTER TABLE sip_trunks
  ADD COLUMN IF NOT EXISTS username      text,
  ADD COLUMN IF NOT EXISTS realm         text,
  ADD COLUMN IF NOT EXISTS proxy         text,
  ADD COLUMN IF NOT EXISTS port          integer,
  ADD COLUMN IF NOT EXISTS transport     text CHECK (transport IN ('udp', 'tcp', 'tls')),
  ADD COLUMN IF NOT EXISTS auth_username text;
