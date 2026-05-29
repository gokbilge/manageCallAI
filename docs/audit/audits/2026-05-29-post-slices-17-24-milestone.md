# Audit — post-slices-17-24-milestone — 2026-05-29

**Commit:** 385e5c9  
**Scope:** Full review of `apps/api/src`, `apps/mcp/src`, `apps/web/src/lib/permissions`,
`db/migrations`, and `docs/` covering all work from SLICE-17 through SLICE-24.  
**Build:** FAIL → fixed during audit (see AUD-2026-05-29-001) → clean  
**Lint:** clean  
**Tests:** 282/282 pass  
**Result:** PASS WITH FINDINGS

---

## Summary

SLICE-17 through SLICE-24 added schedule-aware routing, outbound routing, observability
depth, automation webhooks with retry, MCP tool expansion, a three-tier role model,
tenant audit logging, call recording metadata, bounded data export, and user management.
The codebase is structurally sound: no plaintext secrets in responses, no SELECT *, no
console.log in production code, no TODO/FIXME markers, and tenant isolation holds on all
new repositories.

One build error was found (TypeScript type mismatch in the user controller) and fixed
immediately. Five lower-severity findings are documented below.

---

## Findings

### AUD-2026-05-29-001: TypeScript build failure in user controller PATCH body type

- **Status:** done
- **Severity:** high
- **Location:** `apps/api/src/modules/users/user.controller.ts:86`
- **Finding:** The PATCH route's generic Body type declared `role?: string`, but
  `UpdateUserInput.role` is typed `TenantRole | undefined`. TypeScript rejects the
  assignment. The build was broken — `tsc` exited with code 2. The JSON schema correctly
  enforces the enum at runtime, but the compile-time type was too loose.
- **Fix:** Changed the generic Body parameter to `role?: TenantRole` and imported
  `TenantRole` from `user.types.ts`.
- **Resolved:** fixed in-session (same working tree, post-385e5c9)

---

### AUD-2026-05-29-002: Duplicate migration sequence prefixes

- **Status:** done
- **Severity:** medium
- **Location:** `db/migrations/`
- **Finding:** Three sequence numbers are duplicated:
  - `0005_explicit_sip_trunk_fields.sql` + `0005_relax_inbound_route_match_uniqueness.sql`
  - `0015_add_ivr_flow_session_steps.sql` + `0015_outbound_routes.sql`
  - `0016_add_queues_and_voicemail.sql` + `0016_outbound_call_requests.sql`

  The migration runner (`db/migrate.mjs`) tracks by full filename so all six files are
  applied correctly — alphabetical sort means `_a*` runs before `_o*` within a prefix.
  However, contributors reading the directory see apparent gaps and duplicates and cannot
  determine intended order from the prefix alone. Any future tooling that parses the
  numeric prefix to determine sequence will silently pick the wrong order.
- **Fix:** Applied the shim pattern already used for `0005_relax...`. Converted
  `0015_outbound_routes.sql` and `0016_outbound_call_requests.sql` to no-op compatibility
  shims (comment-only). Re-homed their SQL content to `0021_outbound_routes.sql` and
  `0022_outbound_call_requests.sql` respectively. All SQL is idempotent (`IF NOT EXISTS`,
  `ADD COLUMN IF NOT EXISTS`) so re-application on existing dev DBs is safe.
- **Resolved:** fixed in-session (post-385e5c9)

---

### AUD-2026-05-29-003: `call_events` list endpoint has no row cap

- **Status:** done
- **Severity:** medium
- **Location:** `apps/api/src/modules/call-events/call-event.repository.ts:7–15`
- **Finding:** `listByTenant` issues `SELECT ... FROM call_events WHERE tenant_id = $1
  ORDER BY event_time DESC` with no LIMIT. A tenant with millions of CDRs would cause the
  API process to OOM or time out on a simple `GET /api/v1/call-events`. The export module
  correctly caps at 1000 rows, but the general listing endpoint does not.
- **Fix:** Added `LIMIT 500` to the `listByTenant` query in `call-event.repository.ts`.
- **Resolved:** fixed in-session (post-385e5c9)

---

### AUD-2026-05-29-004: `call_recordings` list endpoint has no row cap

- **Status:** done
- **Severity:** low
- **Location:** `apps/api/src/modules/recordings/recording.repository.ts:27–40`
- **Finding:** `listByTenant` has no LIMIT clause. Currently low-risk because recordings
  are sparse, but it is inconsistent with the cap applied in other list endpoints.
- **Fix:** Added `LIMIT 200` to the `listByTenant` query in `recording.repository.ts`.
- **Resolved:** fixed in-session (post-385e5c9)

---

### AUD-2026-05-29-005: Empty PATCH to `/api/v1/users/:id` issues a no-op DB write

- **Status:** done
- **Severity:** low
- **Location:** `apps/api/src/modules/users/user.repository.ts:44–62`
- **Finding:** If a PATCH request body contains neither `display_name` nor `role`, the
  repository still runs `UPDATE users SET updated_at = NOW() WHERE id = $1 AND
  tenant_id = $2`. This touches the row unnecessarily, advances `updated_at` without
  a real change, and may confuse audit log consumers. The controller does not guard
  against empty bodies.
- **Fix:** Added `minProperties: 1` to the JSON schema body definition in
  `user.controller.ts`. Fastify rejects empty bodies with 400 before the handler runs.
- **Resolved:** fixed in-session (post-385e5c9)

---

### AUD-2026-05-29-006: `fireAuditEvent` swallows failures silently

- **Status:** accepted
- **Severity:** info
- **Location:** `apps/api/src/modules/audit/fire-audit.ts:7–9`
- **Finding:** Audit write failures (DB unavailable, schema mismatch) are silently caught
  and discarded. There is no counter, log line, or alerting mechanism. A misconfiguration
  that breaks the audit table would produce no observable signal to operators.
- **Rationale for acceptance:** Audit failures must not block primary request paths. A
  structured logger (`app.log.warn`) would be the right fix but requires passing the
  Fastify instance or a logger reference into the singleton — a non-trivial refactor.
  Accepted as a known operational gap; document in the ops topology guide.

---

## What is in good shape (no action required)

- **Tenant isolation:** every new repository (`audit`, `recordings`, `export`, `users`,
  `outbound-call`) consistently applies `AND tenant_id = $N` on reads and scopes INSERTs
  to the JWT tenant. No cross-tenant data access paths found.
- **No wildcard columns:** all new modules use explicit column lists in SELECT and
  RETURNING. No `SELECT *` or `RETURNING *` anywhere in `apps/api/src/`.
- **No secrets in responses:** `SipTrunk` responses exclude `auth_password_ciphertext` and
  `auth_password_key_id` via an explicit `returningColumns` list. `TenantUser` responses
  exclude `password_hash`. `CreateUserInput` (internal type) carries `password_hash` only
  in the repo-facing interface, never in the API response type.
- **Role model integrity:** `platform_admin` cannot be written to the `users.role` column
  (DB check constraint only allows the three tenant roles). The auth controller's
  `platform_admin` override applies at JWT issuance from config, not from DB. The service
  layer also rejects `platform_admin` as a role value in the user management API.
- **Guard rules in user service:** self-role-change and self-deactivation are blocked at
  the service layer before any DB call. Duplicate email returns 409, not 500.
- **Auth coverage:** all new controllers apply `requireCapability` on every route.
  `platform.controller.ts` uses `addHook('preHandler', authenticatePlatform)` scoping the
  entire plugin. FreeSWITCH and runtime internal endpoints use `authenticateRuntime`.
  Auth endpoints (`/register`, `/login`) are correctly public.
- **Export row cap:** `export.repository.ts` hard-caps both endpoints at 1000 rows
  regardless of the `limit` query param. The cap is enforced in the repository, not just
  the controller.
- **Migration runner:** tracks by full filename, so duplicate numeric prefixes (finding
  002) do not cause data loss — both files in each pair are applied correctly and
  independently tracked in `schema_migrations`.
- **No console.log, no TODO/FIXME** in any production TypeScript source across `apps/api`,
  `apps/mcp`, or `apps/web`.
- **282 tests, all passing.** New modules (audit, recordings, export, users) all have
  service-layer test coverage.
