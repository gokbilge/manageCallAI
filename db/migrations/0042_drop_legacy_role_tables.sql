-- Drop legacy RBAC join tables.
--
-- The application authorization model is users.role plus computed JWT/API-key
-- capabilities. The initial roles/user_roles/role_policies tables were never used
-- by production code and now create architecture ambiguity.

DROP TABLE IF EXISTS role_policies;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS roles;
