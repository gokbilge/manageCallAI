# Audit - role model cleanup - 2026-06-01

**Commit:** c76c3b2
**Scope:** Issue #2 cleanup for legacy RBAC tables and role-model documentation.
**Result:** PASS

## Findings

### AUD-2026-06-01-001: Legacy role tables created authorization-model ambiguity

- **Status:** done
- **Severity:** medium
- **Location:** `db/migrations/0001_initial_schema.sql`
- **Finding:** The initial schema still contained unused `roles`, `user_roles`, and `role_policies` tables while runtime authorization uses `users.role` and code-defined capabilities. This made the intended authorization source of truth ambiguous for contributors.
- **Fix:** Added `0042_drop_legacy_role_tables.sql` to remove the unused legacy tables and updated database, domain, and capability-model documentation to name `users.role` as the canonical persisted role source.
- **Issue:** https://github.com/gokbilge/manageCallAI/issues/2
- **Resolved:** c76c3b2
