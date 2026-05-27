-- Allow inbound routes to target call groups in addition to flows and extensions.
ALTER TABLE inbound_routes DROP CONSTRAINT IF EXISTS inbound_routes_target_type_check;
ALTER TABLE inbound_routes
  ADD CONSTRAINT inbound_routes_target_type_check
  CHECK (target_type IN ('flow', 'extension', 'call_group'));
