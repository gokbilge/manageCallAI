-- Link inbound routes to a specific phone number (DID).
-- phone_number_id is nullable: routes can still match by pattern or trunk
-- without being tied to a specific provisioned number.

ALTER TABLE inbound_routes
  ADD COLUMN IF NOT EXISTS phone_number_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'inbound_routes'
      AND constraint_name = 'inbound_routes_phone_number_fk'
  ) THEN
    ALTER TABLE inbound_routes
      ADD CONSTRAINT inbound_routes_phone_number_fk
      FOREIGN KEY (phone_number_id) REFERENCES phone_numbers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inbound_routes_phone_number_id
  ON inbound_routes (phone_number_id);
