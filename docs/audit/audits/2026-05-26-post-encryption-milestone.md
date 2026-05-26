# Audit — post-encryption-milestone — 2026-05-26

**Commit:** 756b6af  
**Scope:** Full review of `apps/api`, `apps/worker`, `apps/mcp-server`, `apps/freeswitch-agent`,
`db/migrations`, `docker-compose.yml`, `.github/workflows/ci.yml`, and all docs under `docs/`.  
**Build:** clean  
**Lint:** clean  
**Tests:** 24/24 pass  
**Result:** PASS WITH FINDINGS

---

## Summary

The post-encryption milestone is functionally complete. SIP passwords are encrypted at rest,
auth middleware is enforced on all protected routes, tenant isolation is consistent, CI covers
the full stack, and the Go agent correctly sends the runtime token via `Authorization: Bearer`.

Seven findings were identified. One is high (breaks a documented integration path). The rest
are medium-to-low and do not affect the core API correctness.

---

## Findings

### AUD-2026-05-26-001: Worker webhook body missing `sip_password`

- **Status:** open
- **Severity:** high
- **Location:** `apps/worker/src/modules/webhooks/webhook.controller.ts:4–10`
- **Finding:** `ExtensionCreateBody` does not include `sip_password`, which is now a required
  field on `POST /api/v1/extensions` since the encryption migration. Any n8n→worker→API flow
  for creating extensions returns `400 FST_ERR_VALIDATION`. Additionally, `tenant_id` is in
  the body type but the API ignores it (tenant comes from the JWT), making the field both
  wrong and unused.
- **Fix:** Add `sip_password: string` to `ExtensionCreateBody`. Remove `tenant_id` from the
  body type. Update the webhook to pass `Authorization` from the caller through to the API.
- **Resolved:** <!-- commit sha -->

### AUD-2026-05-26-002: MCP `list_extensions` sends ignored `?tenant_id=` query param

- **Status:** open
- **Severity:** medium
- **Location:** `apps/mcp-server/src/server.ts:69–73`
- **Finding:** The MCP tool builds `GET /api/v1/extensions?tenant_id=<arg>`. The extension
  controller ignores this query param entirely — it reads `tenant_id` from the JWT claim
  only (`extension.controller.ts:28`). The `tenant_id` input to the MCP tool silently does
  nothing; the JWT's tenant always wins. This is not a security issue (isolation holds) but
  it creates a misleading API surface for MCP callers who believe they are scoping by tenant.
- **Fix:** Remove the `tenant_id` parameter from the `list_extensions` MCP tool definition.
  The caller's JWT already scopes the response. If cross-tenant listing is ever needed, it
  requires a separate privileged endpoint, not a query param bypass.
- **Resolved:** <!-- commit sha -->

### AUD-2026-05-26-003: Migration sequence gap — 0003 is absent

- **Status:** open
- **Severity:** low
- **Location:** `db/migrations/`
- **Finding:** Present files are `0001`, `0002`, `0004` — no `0003`. The `0001` schema was
  squashed to include the columns that `0003` originally added (commit `217c41c`). Fresh
  installs work correctly. However, contributors inspecting the directory will notice the gap
  and may assume a file was lost or the runner has a bug.
- **Fix:** Either add a `0003_noop.sql` with a comment explaining the squash, or renumber
  `0004` to `0003` (safe since this is not a production deployment). The `0004` comment
  already explains the rationale but it is easy to miss.
- **Resolved:** <!-- commit sha -->

### AUD-2026-05-26-004: `call_events` uses `SELECT *` and `RETURNING *`

- **Status:** open
- **Severity:** low
- **Location:** `apps/api/src/modules/call-events/call-event.repository.ts:9,26`
- **Finding:** Both `listByTenant` and `create` use wildcard column selection. This is
  inconsistent with the explicit column lists used everywhere else in the codebase and will
  silently return any column added in future migrations. Currently harmless because
  `call_events` has no secret columns, but it is a pattern that should be corrected before
  the table grows.
- **Fix:** Replace `SELECT *` and `RETURNING *` with explicit column lists matching the
  `CallEvent` interface in `call-event.types.ts`.
- **Resolved:** <!-- commit sha -->

### AUD-2026-05-26-005: `default_destination_id` accepts any string; schema expects UUID

- **Status:** open
- **Severity:** low
- **Location:** `apps/api/src/modules/extensions/extension.controller.ts:102–105`,
  `db/migrations/0001_initial_schema.sql:71`
- **Finding:** The database column is typed `uuid`. The JSON schema validation accepts any
  `string`. An invalid UUID is caught by PostgreSQL and surfaces as a 500 Internal Server
  Error rather than a 400 Bad Request, obscuring the actual cause.
- **Fix:** Add `"format": "uuid"` to the JSON schema property for `default_destination_id`
  in both the create and update route schemas. Fastify will then return 400 with a clear
  validation message before the query runs.
- **Resolved:** <!-- commit sha -->

### AUD-2026-05-26-006: Worker `apiRequest` swallows API error bodies

- **Status:** open
- **Severity:** low
- **Location:** `apps/worker/src/api/client.ts:23–26`
- **Finding:** On `!response.ok` the function throws `'API request failed: <status> <text>'`
  without reading the response body. Structured API errors (Fastify validation messages,
  business rule rejections) are invisible in worker logs, making debugging failed webhooks
  significantly harder.
- **Fix:** Read and include the response body in the thrown error message:
  `const body = await response.text(); throw new Error(\`API request failed \${response.status}: \${body}\`)`
- **Resolved:** <!-- commit sha -->

### AUD-2026-05-26-007: Go agent multi-tenant limitation is undocumented

- **Status:** open
- **Severity:** info
- **Location:** `apps/freeswitch-agent/internal/config/config.go:21`,
  `apps/freeswitch-agent/README.md`
- **Finding:** The agent stamps a static `MANAGECALLAI_TENANT_ID` onto every forwarded event.
  This couples one running agent instance to one tenant. Multi-tenant deployments require one
  agent per tenant. This constraint is not stated in the README, which will surprise operators
  who attempt to share a single agent across tenants.
- **Fix:** Add a note to `apps/freeswitch-agent/README.md` under a "Tenant scope" heading
  that makes the one-agent-per-tenant constraint explicit and describes the multi-tenant
  deployment pattern (one container per tenant with distinct `MANAGECALLAI_TENANT_ID`).
- **Resolved:** <!-- commit sha -->

---

## What is in good shape (no action required)

- Tenant isolation enforced on all extension mutations (`AND tenant_id = $N` everywhere).
- `authenticate` and `authenticateRuntime` both `return reply.send()` — Fastify lifecycle
  stops correctly on 401.
- AES-256-GCM encryption: random IV per call, GCM auth tag verified on decrypt, key
  cached lazily so unit tests that don't touch crypto are not blocked.
- `Extension` API response never contains any password or ciphertext field; confirmed by
  integration test assertions on every CRUD response.
- `call_events` has composite indexes on `(tenant_id, call_id)` and
  `(tenant_id, event_time DESC)`.
- Go agent sends `Authorization: Bearer <token>` header (not query param) for ingest.
- CI pipeline runs: TypeScript build, lint, tests (24/24), Go build, migrations — on every push.
- `dist/` is gitignored; zero `dist/` files tracked.
- No `console.*` in production source. No TODO/FIXME markers.
