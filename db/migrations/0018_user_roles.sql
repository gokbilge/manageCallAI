ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'tenant_admin'
    CHECK (role IN ('tenant_admin', 'tenant_operator', 'tenant_viewer'));
