-- Replace the schema-level unique constraint on (tenant_id, match_type, match_value)
-- with a partial unique index that only enforces uniqueness among *active* routes.
-- This allows multiple draft routes for the same DID/trunk/pattern while preventing
-- two active routes from claiming the same inbound match simultaneously.

ALTER TABLE inbound_routes
  DROP CONSTRAINT IF EXISTS inbound_routes_tenant_id_match_type_match_value_key;

CREATE UNIQUE INDEX inbound_routes_active_unique_match
  ON inbound_routes (tenant_id, match_type, match_value)
  WHERE status = 'active';
