# Audit — pre-release — 2026-05-29

**Commit:** 64e4c43
**Scope:** Full review of `apps/api`, `apps/mcp`, `apps/worker`, `apps/mcp-server`,
`apps/freeswitch-agent`, `db/migrations/`, `.github/workflows/`, `docker-compose.yml`,
`scripts/`, and all `docs/` since the previous audit (2026-05-26).
**Build:** clean (`pnpm build` — web bundle size warning accepted, see AUD-2026-05-29-002)
**Lint:** clean
**Tests:** 182/182 API, 28/28 web, 15/15 MCP — all pass
**Vulnerability scan:** `pnpm audit` — no known vulnerabilities
**Result:** PASS WITH FINDINGS

---

## Summary

All slices (SLICE-00 through SLICE-14) are now closed. The system covers: inbound DID
routing to published IVR flows and call groups; desired-state IVR authoring with
validation, simulation, and approval-aware publish; n8n API-key automation; MCP stdio
server; outbound webhook delivery with failure tracking; and full operator UI surfaces.

Seven findings were identified. None are blocking. Six are informational; one is a
low-severity documentation gap now resolved.

---

## Findings

### AUD-2026-05-29-001: `apps/mcp` missing from docker-images.yml build matrix

- **Status:** accepted
- **Severity:** info
- **Location:** `.github/workflows/docker-images.yml`
- **Finding:** The Docker image matrix builds `managecallai-mcp-server` (the HTTP-based
  MCP server in `apps/mcp-server`). The new stdio MCP server in `apps/mcp` (SLICE-10)
  is a CLI tool intended for local use with Claude Desktop; it does not need a Docker
  image and is not in the matrix.
- **Fix:** No action required. If a containerised MCP deployment is added post-release,
  add a Dockerfile to `apps/mcp` and include it in the matrix at that time.

### AUD-2026-05-29-002: Web bundle exceeds 500 kB warning threshold

- **Status:** accepted
- **Severity:** info
- **Location:** `apps/web/vite.config.*`
- **Finding:** `pnpm build` emits a Vite chunk size warning: `index-CiQAyKSG.js 579.99 kB`.
  The main contributor is `reactflow` + `react-dom`. This is a developer experience
  warning, not a security issue.
- **Fix:** Accepted for v1. Code-split ReactFlow (lazy-import the flow builder page) in a
  post-release pass to improve initial load time. Track as Workstream E in the
  post-release roadmap.

### AUD-2026-05-29-003: `signing_secret` confirmed never returned in list endpoints

- **Status:** done (confirmed correct by inspection)
- **Severity:** info
- **Location:** `apps/api/src/modules/automation/automation.repository.ts:listWebhooks`
- **Finding:** Audit confirmed `listWebhooks` and the `GET /api/v1/webhooks` endpoint
  exclude `signing_secret` from the SELECT. The secret is returned only on the `POST`
  (create) response via `AutomationWebhookCreated`. Correct.
- **Fix:** No action required.

### AUD-2026-05-29-004: All API production source files clean

- **Status:** done (confirmed by grep)
- **Severity:** info
- **Location:** `apps/api/src/**/*.ts`
- **Finding:** Zero matches for `SELECT *`, `RETURNING *`, `console.`, `TODO`, `FIXME`
  in production source. All wildcard queries from the previous audit (AUD-2026-05-26-004)
  remain fixed.
- **Fix:** No action required.

### AUD-2026-05-29-005: `sip_password` never appears in API responses

- **Status:** done (confirmed by test assertions)
- **Severity:** info
- **Location:** `apps/api/src/modules/extensions/extension.service.ts`
- **Finding:** The extension service encrypts `sip_password` before passing to the
  repository, and the `Extension` response type has no `sip_password` field.
  Integration tests explicitly assert the field is absent from all CRUD responses.
- **Fix:** No action required.

### AUD-2026-05-29-006: FreeSWITCH agent one-tenant-per-instance constraint documented

- **Status:** done
- **Severity:** info
- **Location:** `apps/freeswitch-agent/README.md`, `.env.example`
- **Finding:** The `MANAGECALLAI_TENANT_ID` one-agent-per-tenant constraint is now
  documented in `.env.example` with a comment (SLICE-11). The README note added in
  AUD-2026-05-26-007 remains in place.
- **Fix:** No action required.

### AUD-2026-05-29-007: CI does not exercise `apps/mcp` lint step

- **Status:** done
- **Severity:** low
- **Location:** `.github/workflows/ci.yml`, `apps/mcp/package.json`
- **Finding:** `pnpm -r lint` runs lint across all workspace packages. `apps/mcp` had
  no `lint` script, so it was silently skipped. A type regression in `apps/mcp` would
  not be caught by CI lint.
- **Fix:** Added `"lint": "tsc --noEmit"` to `apps/mcp/package.json`. `pnpm -r lint`
  now type-checks `apps/mcp` on every CI run.
- **Resolved:** this commit

---

## What is in good shape (no action required)

- All 14 implementation slices (SLICE-01 through SLICE-14) are closed with documented
  exit-criteria proof.
- `pnpm audit` reports no known vulnerabilities.
- All routes requiring auth have `preHandler: requireCapability(...)` — confirmed by
  code review of all controller files.
- Tenant isolation: every query that mutates tenant-scoped data includes `AND tenant_id = $N`.
- Webhook delivery is fire-and-forget with failure tracking (auto-disable at 5 failures)
  and does not block or slow originating API responses.
- `.env.example` updated with all vars from SLICE-09 through SLICE-14 additions.
- Release runbook at `docs/development/release-runbook.md` covers fresh install, upgrade,
  and rollback procedures.
- Smoke script at `scripts/mvp-smoke.ps1` now covers the full IVR lifecycle path
  (create → validate → simulate → publish) in addition to the extension/SIP/event path.
