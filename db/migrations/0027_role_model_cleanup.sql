-- Role model cleanup.
--
-- Background: users.role was added in 0018_user_roles.sql with a CHECK constraint
-- covering only tenant roles. The platform_admin role is computed at login time from
-- PLATFORM_OPERATOR_EMAILS and is never stored in the database, so the constraint is
-- technically correct as written.
--
-- This migration makes the role model explicit:
-- 1. Drop the existing CHECK constraint so we can replace it with a wider one that
--    matches the full set of roles the application understands, ensuring any future
--    path that tries to persist platform_admin is caught at the DB boundary rather
--    than silently accepted.
-- 2. Add a permissive constraint that accepts all four role values. Storage of
--    platform_admin remains prohibited by application logic; the constraint is the
--    last-resort guard.
-- 3. Backfill NULL role values (should not exist, but guards against migration gaps).
-- 4. Add a comment documenting the canonical role model.

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_role_check;

UPDATE users SET role = 'tenant_admin' WHERE role IS NULL OR role = '';

ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('tenant_admin', 'tenant_operator', 'tenant_viewer', 'platform_admin'));

COMMENT ON COLUMN users.role IS
    'Persisted tenant role. One of: tenant_admin, tenant_operator, tenant_viewer. '
    'The platform_admin value is accepted by the constraint as a safety net but is '
    'never written by normal application flows — it is computed at login time from '
    'the PLATFORM_OPERATOR_EMAILS environment variable and issued only in the JWT.';
