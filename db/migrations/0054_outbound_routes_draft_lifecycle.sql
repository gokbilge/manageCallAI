-- Allow outbound routes to be created in a draft state before being
-- published (activated) by an operator. This mirrors the validate/publish
-- lifecycle already in use for inbound routes and IVR flows.
--
-- 'draft'    — created but not yet routing live traffic
-- 'active'   — published; routed by the FreeSWITCH resolve endpoint
-- 'inactive' — deactivated; no longer routing

ALTER TABLE outbound_routes
  DROP CONSTRAINT IF EXISTS outbound_routes_status_check;

ALTER TABLE outbound_routes
  ADD CONSTRAINT outbound_routes_status_check
    CHECK (status IN ('draft', 'active', 'inactive'));
