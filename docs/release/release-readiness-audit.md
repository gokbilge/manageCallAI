# Release Readiness Audit

**Audit date:** 2026-06-01  
**Auditor:** Principal release engineer / security reviewer  
**Repository:** https://github.com/gokbilge/manageCallAI  
**Commit audited:** `668f03c` (main, post slices 43–50)

---

## 1. Executive Summary

manageCallAI is an AI-native telecom control plane built over stock FreeSWITCH. The backend API, IVR lifecycle, MCP server, automation layer, and CI quality gates are well-built for an early-stage project. Architecture boundaries are cleanly enforced. All major CI checks pass. No open CodeQL security alerts exist on main.

The project is **ready for internal alpha** and is **close to public alpha**. It is **not ready for public beta or production** due to missing FreeSWITCH smoke CI, incomplete visual IVR builder polish, multi-instance rate-limit evidence requirements, gaps in frontend test coverage, one stale README count, and several documentation gaps.

**No critical security findings** were uncovered. The most significant runtime risk is `ALLOW_RUNTIME_TOKEN_FALLBACK=true` in `docker-compose.yml` (development default), which must not be used in production.

---

## 2. Final Release Classification

| Stage | Status | Verdict |
|---|---|---|
| **Internal alpha** | ✅ Ready | CI passes, demo loop runnable locally, core API proven |
| **Public alpha** | ⚠️ Almost ready | One stale README count; FreeSWITCH smoke CI gated; alpha docs need final pass |
| **Public beta** | ❌ Not ready | FreeSWITCH smoke CI, visual IVR polish, tenant isolation matrix, coverage gaps |
| **Production (self-hosted)** | ❌ Not ready | Multi-instance rate limiting, soak tests, restore rehearsal, carrier interop |
| **SaaS / multi-tenant production** | ❌ Not ready | All production gates plus Redis/shared rate limiting, monitoring, SLO evidence |

---

## 3. Ready / Not-Ready Table

| Area | Ready for Alpha | Notes |
|---|---|---|
| Auth / RBAC | ✅ | JWT, role model, API keys, platform admin all working |
| Core telecom CRUD | ✅ | Extensions, trunks, numbers, routes, groups, queues, voicemail, prompts |
| IVR lifecycle | ✅ | Validate, simulate, publish, approval gating, rollback, version history |
| Outbound calls | ✅ | Route resolution, safety policy, rate cap, fraud policy (SLICE-45) |
| MCP server | ✅ | 16 tools, contract drift check, capability safety, audit identity |
| n8n / webhooks | ✅ | 17 events, signing, replay protection, DLQ, 9 importable workflow templates |
| Observability HUD | ⚠️ | Live snapshot + SSE stream works; security alert UI not yet in admin panel |
| Visual IVR builder | ⚠️ | Node graph, validate, simulate, publish panels exist; publish diff and rollback affordance need polish |
| Frontend coverage | ⚠️ | 53% statements — well below 80% beta target |
| FreeSWITCH smoke CI | ❌ | Commented out in CI; self-hosted runner workflow exists but not wired to required gates |
| SDK publish | ⚠️ | `private` flag absent but no `main`/`types` entries; not npm-publishable yet |
| Multi-instance rate limiting | ❌ | In-memory only; unsafe for horizontal scaling |
| Backup / restore | ⚠️ | Playbook exists; `pnpm restore:smoke` script requires real deployment |
| Production secrets enforcement | ✅ | `APP_ENV=production` rejects defaults |
| Security alert management UI | ❌ | Backend (SLICE-48) done; frontend panel not yet in admin UI |
| Retention / legal hold UI | ❌ | Backend (SLICE-47) done; frontend panel not yet in admin UI |

---

## 4. Area-by-Area Scores (0–10)

| Area | Score | Gap summary |
|---|---|---|
| Product scope | 8 | Core telecom + AI surfaces implemented; fraud policy, retention, security alerts backend done; UIs missing for 2 of 3 |
| Architecture | 9 | Boundaries clean; FreeSWITCH runtime-only; PostgreSQL desired state; MCP/n8n narrower than REST |
| API / backend | 9 | 99 OpenAPI operations, consistent error model, RBAC, idempotency, audit, rate limiting |
| Database / migrations | 9 | 41 prefixes, clean ordering, 3 noop shims documented, FK integrity, constraints verified |
| Runtime / FreeSWITCH | 7 | XML generation, dialplan/directory endpoints, Go agent ESL proven locally; smoke CI not in required CI gate |
| IVR lifecycle | 9 | Graph model, validation, simulation, publish, approval, rollback, version history all in place |
| MCP | 9 | 16 tools, contract drift check, no raw ESL/XML, capability safety, audit actor |
| n8n / webhooks | 8 | 17 events, 9 workflow templates, signing/replay/DLQ; missing step-by-step n8n setup guide |
| Frontend / admin UI | 6 | Pages exist for all major domains; IVR builder functional; security alert, retention, legal hold UIs absent; 53% coverage |
| SDK | 5 | Generated types correct; only 6 wrapped endpoints; not npm-publishable (missing `main`/`types`); README claims 6 endpoints, actual coverage low |
| Security | 8 | No open CodeQL alerts; secrets scan passes; runtime token hardening documented; docker-compose fallback default is dev-only risk |
| CI / tooling | 9 | 20+ CI checks; all pass; FreeSWITCH smoke CI exists but gated to self-hosted runner |
| Coverage / tests | 7 | API 68% stmts / 80% branches; Web 53%; MCP 84%; SDK 99%; Go agent 55–100% by package; thresholds set but below beta targets |
| Docs | 7 | Architecture, API, ops, security, n8n docs exist; README has stale test/OpenAPI counts; `RUNTIME_API_TOKEN_SECONDARY` missing from `.env.example` |
| Deployment | 7 | Production deployment guide solid; docker-compose present; Redis or edge rate-limit evidence still required; `restore:smoke` needs real env |
| Release governance | 6 | Release checklist exists; no GitHub release tags; no CHANGELOG; no milestones or project board |

---

## 5. What Is Ready

### Backend / API
- Auth: JWT, multi-tenant register/login, platform admin (`PLATFORM_OPERATOR_EMAILS`), role-based capability model (viewer / operator / admin / platform_admin).
- Scoped API keys with explicit capability grants and wildcard legacy support.
- Full telecom CRUD: extensions (SIP credentials encrypted at rest), SIP trunks (SRTP policy), phone numbers, inbound routes, outbound routes, call groups, queues, voicemail boxes, prompt assets, schedules.
- IVR graph model with node validation, semantic validation, simulation, branch-coverage tracking, approval gating, publish, rollback, and version history.
- Outbound call dispatch: route resolution, global safety policy (emergency + premium-rate), route-level allow/block lists, per-minute rate cap, fraud policy (SLICE-45).
- Recording ingestion, analysis requests (transcript/summary), retention policy, legal holds.
- Security alert rules and instances (SLICE-48): 6 alert types, cooldown, evaluate endpoint.
- FreeSWITCH node registry with HMAC-signed auth (SLICE-43).
- Webhook delivery with signing, replay protection, DLQ, idempotency.
- Tenant audit log, export, observability snapshot/SSE, platform runtime health.
- Runtime auth: Bearer / Basic / header token; secondary token for rotation; failure audit events; query/body fallback production-disabled by default.
- Error model: consistent `{ error, message, request_id }` envelope; all 99 operations have a default error response.
- Idempotency records for POST/PATCH automation paths.
- Rate limiting on auth, runtime, webhook, outbound, general API, and metrics endpoints.

### Database
- 44 migration files, 41 unique prefixes, 3 documented noop shims.
- Clean FK integrity, NOT NULL constraints, CHECK constraints on all enum columns.
- Indexes on hot runtime lookup paths.
- Audit log is append-only at service boundary (INSERT only via `fireAuditEvent`).

### FreeSWITCH runtime (locally proven)
- `mod_xml_curl` directory and dialplan endpoints implemented.
- XML escaping and regex escaping tested with golden files.
- SIP credentials encrypted at rest; decrypted only at directory XML generation time.
- Go ESL agent: event forwarding, dispatcher, forwarder (55–100% coverage by package).
- FreeSWITCH Dockerfile present; docker-compose `freeswitch` profile available.

### MCP server
- 16 tools verified against contracts; no raw ESL/XML/shell tools.
- Tool-level risk assessment (`risk.ts`).
- Audit actor identity (MCP session ID stamped in audit events).
- API-key auth with capability scoping.

### n8n / webhooks
- 9 importable workflow JSON examples (missed call, voicemail, IVR publish, rollback, recording transcribed, approval review, call anomaly).
- Webhook signature verification and replay-window verification guide.
- Webhook verification JS helper.

### CI
- Build, lint, secret scan, dependency audit (high-level), migration checks, DB contracts, DB constraints, OpenAPI generate + drift, 99 operations coverage check, tests, Go tests, MCP contract drift, webhook payload coverage, API key alignment, production readiness manifest, IVR simulation regression, runtime XML golden tests, Docker builds, CodeQL.

### Security
- 0 open CodeQL alerts on main.
- Secret scan passes (749 tracked files).
- Dependency audit passes at high level.
- Production secrets enforcement (`APP_ENV=production` rejects defaults).
- Runtime token: no query/body fallback in production; failure audit events; secondary token support.

---

## 6. What Is Missing

### MUST FIX before public alpha

1. **README stale counts** — README still says "327 tests, 97 OpenAPI operations." Actual: 683 tests, 99 operations. (Verified: `README.md` line ~68.)
2. **`.env.example` missing `RUNTIME_API_TOKEN_SECONDARY`** — Added to `apps/api/src/config/env.ts` in SLICE-46 but not surfaced in `.env.example`. Operators rotating tokens won't know the variable exists.

### SHOULD FIX before public alpha

3. **FreeSWITCH smoke CI not in required CI gate** — `check-freeswitch-profile.mjs` is commented out of `ci.yml`. The self-hosted runner workflow exists (`freeswitch-smoke.yml`) but is optional. The release checklist requires manual evidence before tagging. This is acceptable for internal alpha but should be a required gate for public alpha.
4. **Security alert management UI** — SLICE-48 backend is complete; the admin panel has no page for viewing, acknowledging, or dismissing security alerts.
5. **Retention policy and legal hold UI** — SLICE-47 backend is complete; the admin panel has no page for managing retention policies or legal holds.
6. **Frontend coverage at 53%** — Well below the 80% beta target. IVR builder, observability cockpit, and security surfaces need more test coverage.

### MUST FIX before beta

7. **FreeSWITCH smoke CI as required gate** — Must run automatically for every release branch, not just manually.
8. **Visual IVR builder publish diff and rollback affordance** — Publish diff preview and rollback state visualization are noted as missing in the alpha readiness doc. `PublishPanel.tsx` exists (182 lines) but doesn't show a diff.
9. **Multi-instance rate limiting** -- Redis shared-store implementation exists. Production promotion still requires `RATE_LIMIT_STORE=redis` with `RATE_LIMIT_REDIS_URL`, another external limiter, or edge-gateway evidence.
10. **SDK not npm-publishable** — `packages/sdk/package.json` has no `main`, `types`, or `exports` fields. The package claims version `0.1.0` but is not importable from npm.
11. **Tenant isolation matrix coverage** — RBAC matrix integration test exists (613 lines, `rbac-matrix.integration.test.ts`) but cross-tenant write/read isolation for recordings, security alerts, retention policies, and the new fraud policy is not covered.
12. **Go ESL agent main package coverage: 0%** — `apps/freeswitch-agent` top-level package has 0% coverage (main.go initialization path). Internal packages have good coverage.

### MUST FIX before production

13. **Backup / restore rehearsal with evidence** — `restore:smoke` script exists; no evidence of an actual rehearsal run. The release checklist requires evidence.
14. **Soak test evidence** — `production:soak` script exists; no evidence of a completed soak run.
15. **Carrier interop evidence** — `carrier:interop-check` requires `--evidence=<file>`. No evidence file exists.
16. **`ALLOW_RUNTIME_TOKEN_FALLBACK=true` in docker-compose.yml** — The `api` service in `docker-compose.yml` defaults `ALLOW_RUNTIME_TOKEN_FALLBACK=${ALLOW_RUNTIME_TOKEN_FALLBACK:-true}`. If an operator runs `docker compose up` in production without setting this variable, token fallback is enabled. Should default to `false`.

### NICE TO HAVE

17. No GitHub releases, tags, or CHANGELOG.
18. No milestones or project board on GitHub.
19. CONTRIBUTING.md is 33 lines — minimal. A more detailed contributor guide (dev setup, test approach, PR expectations) would help.
20. SDK client wraps only 6 of 99 API endpoints. Not a blocker for alpha but limits SDK usefulness.
21. `check-freeswitch-profile.mjs` requires `FREESWITCH_ESL_PASSWORD` env var — cannot run in standard CI without a live FreeSWITCH.
22. Rate limit topology check warns that explicit production limits are not configured (4 warnings) — limits exist as env vars but CI doesn't enforce non-default values.

---

## 7. Release Blockers

### Public Alpha Blockers (P0)

| # | Blocker | File(s) | Fix |
|---|---|---|---|
| 1 | README stale test/operation counts | `README.md:68` | Update "327 tests, 97 operations" → "683 tests, 99 operations" |
| 2 | `.env.example` missing `RUNTIME_API_TOKEN_SECONDARY` | `.env.example` | Add commented entry with rotation instructions |

### Beta Blockers (P1)

| # | Blocker | File(s) | Fix |
|---|---|---|---|
| 3 | FreeSWITCH smoke CI not required | `.github/workflows/ci.yml` | Uncomment or add required gate |
| 4 | Security alert UI absent | `apps/web/src/features/` | Add security alerts page |
| 5 | Retention / legal hold UI absent | `apps/web/src/features/` | Add compliance/retention page |
| 6 | Frontend coverage 53% | `apps/web/` | Add tests to reach ≥70% for beta |
| 7 | Publish diff in IVR builder absent | `apps/web/src/features/ivr-builder/` | Add diff preview to PublishPanel |
| 8 | Multi-instance rate limiting evidence | `apps/api/src/security/rate-limit.ts`, `docs/ops/rate-limit-topology.md` | Configure Redis or edge-level enforcement in production evidence |
| 9 | SDK not npm-publishable | `packages/sdk/package.json` | Add `main`, `types`, `exports` fields |

### Production Blockers (P2)

| # | Blocker | File(s) | Fix |
|---|---|---|---|
| 10 | `docker-compose.yml` ALLOW_RUNTIME_TOKEN_FALLBACK defaults to true | `docker-compose.yml:27` | Change default to `false` |
| 11 | No restore rehearsal evidence | `scripts/restore-smoke.mjs` | Run against a real deployment |
| 12 | No soak test evidence | `scripts/production-soak.mjs` | Run and attach evidence |
| 13 | No carrier interop evidence | `scripts/carrier-interop-check.mjs` | Run with real carrier and attach evidence |

---

## 8. Public Alpha Checklist

- [ ] Fix README stale test/operation counts (P0)
- [ ] Add `RUNTIME_API_TOKEN_SECONDARY` to `.env.example` (P0)
- [ ] Verify demo loop from a clean clone end-to-end
- [ ] Tag `v0.1.0-alpha` on GitHub
- [ ] Confirm 0 CodeQL alerts on tagged commit ✅ (currently 0)
- [ ] Confirm secret scan passes on tagged commit ✅
- [ ] Confirm dependency audit passes at high level ✅
- [ ] Confirm all CI checks pass on main ✅
- [ ] Capture FreeSWITCH E2E smoke evidence manually or via self-hosted runner
- [ ] Publish `docs/release/public-alpha-readiness.md` (exists ✅)
- [ ] Add known limitations section to README

---

## 9. Beta Checklist

All public alpha items, plus:

- [ ] FreeSWITCH smoke CI as required gate for every release branch
- [ ] Visual IVR builder: publish diff preview, rollback state UI
- [ ] Security alert management UI page in admin panel
- [ ] Retention policy + legal hold UI page in admin panel
- [ ] Frontend coverage ≥ 70% statements
- [ ] Tenant isolation matrix: add cross-tenant tests for recordings, security alerts, fraud policy
- [ ] SDK: add `main`, `types`, `exports` to `package.json`; extend client to cover ≥ 30 endpoints
- [x] Multi-instance rate limiting: Redis adapter and edge guidance exist
- [ ] CHANGELOG and release notes policy

---

## 10. Production Checklist

All beta items, plus:

- [ ] Production runtime E2E gate with sanitized evidence (`pnpm production:e2e`)
- [ ] Soak test evidence (`pnpm production:soak`)
- [ ] Restore rehearsal evidence (`pnpm restore:smoke`)
- [ ] Carrier interop evidence (`pnpm carrier:interop-check`)
- [ ] Release evidence bundle (`pnpm release:evidence-check`)
- [x] Multi-instance rate limiting implemented and tested
- [ ] Deployment hardening: `docker-compose.yml` `ALLOW_RUNTIME_TOKEN_FALLBACK` defaults to `false`
- [ ] TLS/SRTP guidance verified for trunk configuration
- [ ] Monitoring, alerting, and on-call runbooks
- [ ] SLO definitions and evidence

---

## 11. Security Findings

| Severity | Finding | Evidence | Status |
|---|---|---|---|
| ⚠️ Medium | `ALLOW_RUNTIME_TOKEN_FALLBACK=true` in `docker-compose.yml` | `docker-compose.yml:27` | Dev default; acceptable for local dev only; must not reach production |
| ℹ️ Info | Rate limit topology warns 4 non-default values not configured | `scripts/rate-limit-topology-check.mjs` | Defaults are reasonable; explicit production values recommended |
| ℹ️ Info | Go ESL main package 0% coverage | `apps/freeswitch-agent` | Main loop startup; integration-tested only via docker smoke |
| ✅ None | CodeQL: 0 open alerts on main | GitHub code scanning | `js/missing-rate-limiting` suppressed by project config (false positive — global onRequest hook not traceable) |
| ✅ None | Secret scan: 749 files clean | `scripts/check-secrets.mjs` | Passes |
| ✅ None | Dependency audit: 0 high-severity vulns | `pnpm audit --audit-level=high` | Passes |
| ✅ None | SIP credentials: encrypted at rest | `apps/api/src/crypto/sip-secret.ts` | AES-256-GCM, key in env |
| ✅ None | Runtime token: no fallback in production | `apps/api/src/config/env.ts:65` | `ALLOW_RUNTIME_TOKEN_FALLBACK` defaults to `!isProduction` |
| ✅ None | JWT secrets validated in production | `apps/api/src/config/env.ts:86` | Rejects defaults and short values |
| ✅ None | Webhook signing: HMAC-SHA256 | `apps/api/src/modules/automation/webhook-signature.ts` | Replay-window enforcement verified in tests |
| ✅ None | XML injection: escaped | `apps/api/src/modules/freeswitch/dialplan-builders.ts` | Golden tests cover escaping |
| ✅ None | MCP: no raw ESL/XML/shell tools | `apps/mcp/src/tools/risk.ts` | Risk assessor enforces tool safety |
| ✅ None | Tenant isolation: API scoped by tenant_id | All repositories | `tenant_id` required on all tenant-scoped queries |
| ✅ None | Outbound fraud: global emergency/premium-rate blocked | `apps/api/src/modules/runtime/outbound-call.service.ts` | Non-bypassable; fraud policy adds tenant-level controls |

---

## 12. CodeQL / Code-Scanning Status

- **Open alerts on main:** 0
- **`js/missing-rate-limiting`:** Suppressed via `.github/codeql/codeql-config.yml`. The project uses a global Fastify `onRequest` hook in `app.ts` that rate-limits all `/api/v1/*` routes. CodeQL cannot trace cross-file hook registration. Suppression is documented and justified.
- **CodeQL workflow:** Runs on every PR against main and on push to main. Analyzes JavaScript/TypeScript and Go.
- **SARIF export:** Standard GitHub Advanced Security UI.

---

## 13. CI and Test Results

All commands run against commit `668f03c` (main) unless noted.

| Check | Result | Notes |
|---|---|---|
| `pnpm build` | ✅ PASS | TypeScript: API, worker, MCP, MCP-server, web |
| `pnpm lint` | ✅ PASS | 1 web warning (react-hooks/exhaustive-deps — pre-existing) |
| `pnpm test` | ✅ PASS | 683 tests, 58 test files |
| `pnpm check:api-key-capabilities` | ✅ PASS | Alignment verified |
| `pnpm check:webhook-payloads` | ✅ PASS | 17 events covered |
| `pnpm check:mcp-schemas` | ✅ PASS | 16 tools verified |
| `pnpm check:mcp-contracts` | ✅ PASS | 61 MCP tests pass |
| `pnpm generate:openapi` | ✅ PASS | 199 components, 75 paths, 99 operations |
| `node scripts/check-openapi-coverage.mjs` | ✅ PASS | 99 operations, all with error response |
| `node scripts/check-secrets.mjs` | ✅ PASS | 749 files |
| `node scripts/check-migration-order.mjs` | ✅ PASS | 44 files, 41 prefixes, 3 noop shims |
| `node scripts/check-ivr-simulation.mjs` | ✅ PASS | 92 tests |
| `node scripts/check-coverage-ignores.mjs` | ✅ PASS | No unapproved ignores |
| `node scripts/check-production-readiness.mjs` | ✅ PASS | |
| `node scripts/check-db-contracts.mjs` | ✅ PASS | 11 required columns |
| `node scripts/check-db-constraints.mjs` | ✅ PASS | 26 checks |
| `node scripts/rate-limit-topology-check.mjs` | ⚠️ WARN | 4 warnings: explicit production limits not configured in env |
| `node scripts/check-freeswitch-profile.mjs` | ❌ SKIP | Requires `FREESWITCH_ESL_PASSWORD` (expected; no live FreeSWITCH) |
| `node scripts/carrier-interop-check.mjs` | ❌ SKIP | Requires `--evidence=<file>` (expected; no carrier evidence) |
| `node scripts/release-evidence-check.mjs` | ❌ SKIP | Requires `--manifest=<file>` (expected; no release evidence) |
| `go test ./... -cover` (freeswitch-agent) | ✅ PASS | main:0%, config:100%, dispatcher:75.6%, esl:55.5%, events:100%, forwarder:88%, logging:100% |

---

## 14. Coverage Summary

### API (`apps/api`)
| Metric | Value | Threshold | Status |
|---|---|---|---|
| Statements | 68.21% | 66% | ✅ |
| Branches | 80% | 78% | ✅ |
| Functions | 70.41% | 69% | ✅ |
| Lines | 68.21% | 66% | ✅ |

Beta target: 88–90%. Gap: ~20 points.

### Web (`apps/web`)
| Metric | Value |
|---|---|
| Statements | 53.36% |
| Branches | 71.65% |
| Functions | 59% |
| Lines | 53.36% |

Beta target: 80%. Gap: ~27 points. No enforced threshold in vitest config.

### MCP (`apps/mcp`)
| Metric | Value |
|---|---|
| Statements | 84.07% |
| Branches | 79.81% |
| Functions | 96% |

Beta target: 85%. Nearly there.

### SDK (`packages/sdk`)
| Metric | Value |
|---|---|
| Statements | 99.25% |
| Branches | 92.85% |
| Functions | 100% |

Excellent. SDK client is small (6 endpoints) but fully tested.

### Go agent (`apps/freeswitch-agent`)
| Package | Coverage |
|---|---|
| main | 0% |
| internal/config | 100% |
| internal/dispatcher | 75.6% |
| internal/esl | 55.5% |
| internal/forwarder | 88% |
| internal/events | 100% |
| internal/logging | 100% |

---

## 15. Runtime / FreeSWITCH Readiness

### What is proven
- Directory XML endpoint (`GET /api/v1/freeswitch/directory`) generates correct SIP directory XML, tested with golden files and an integration test.
- Dialplan XML endpoint generates correct dialplan for IVR, queue, call-group, and voicemail targets. XML escaping tested.
- `mod_xml_curl` callbacks work with the runtime token.
- Go ESL agent handles event forwarding from FreeSWITCH to the API.
- SIP REGISTER smoke script (`scripts/sip-register-smoke.mjs`) documented for local use.
- FreeSWITCH Dockerfile compiles from source (v1.10.12); docker-compose `freeswitch` profile available.
- Runtime token fallback is disabled in production.
- HMAC-signed node auth middleware (SLICE-43) adds cryptographic node identity.

### What is NOT proven in CI
- End-to-end SIP REGISTER → directory lookup → IVR session start → ESL event ingest in hosted CI.
- The FreeSWITCH smoke CI job (`freeswitch-smoke.yml`) requires a self-hosted runner with label `[self-hosted, freeswitch]`. It is skipped in standard GitHub-hosted runners.
- `check-freeswitch-profile.mjs` is commented out of `ci.yml`.

### Risk
- No automated proof that a real SIP client can register and invoke an IVR flow in CI. Manual smoke evidence required before any release beyond internal alpha.

---

## 16. Documentation Gaps

| Gap | Priority | File |
|---|---|---|
| README stale counts ("327 tests, 97 operations") | P0 | `README.md` |
| `.env.example` missing `RUNTIME_API_TOKEN_SECONDARY` | P0 | `.env.example` |
| n8n step-by-step setup guide (doc exists but lacks deployment walkthrough) | P2 | `docs/automation/n8n-guide.md` |
| Security alert management (SLICE-48) — no operator-facing UI docs | P1 | `docs/` |
| Retention policy / legal hold (SLICE-47) — no operator-facing UI docs | P1 | `docs/` |
| FreeSWITCH node registry (SLICE-43) — no operator setup guide | P1 | `docs/ops/` |
| SDK publish instructions and endpoint coverage list | P1 | `packages/sdk/README.md` |
| CHANGELOG / release notes | P2 | root |

---

## 17. GitHub / Community / Governance Gaps

| Gap | Priority |
|---|---|
| No GitHub release tags or version tags | P1 |
| No CHANGELOG | P2 |
| No milestones or project board | P3 |
| CONTRIBUTING.md is minimal (33 lines) — no dev setup instructions | P2 |
| SECURITY.md is 45 lines — solid for alpha; needs vulnerability response SLA for beta | P2 |
| SUPPORT.md exists but is sparse | P3 |
| No issue triage labels or priority labeling convention (labels exist but no policy) | P3 |
| 1 open issue (Issue #2: legacy roles/user_roles model) — still open | P2 |

---

## 18. Prioritized Roadmap

### Immediate (before public alpha tag)
1. Fix README stale counts
2. Add `RUNTIME_API_TOKEN_SECONDARY` to `.env.example`
3. Tag `v0.1.0-alpha`

### Short-term (public alpha stabilization)
4. Security alert management UI
5. Retention/legal hold UI
6. FreeSWITCH smoke CI evidence (manual or self-hosted)
7. Frontend coverage improvements (focus on IVR builder and observability cockpit)

### Medium-term (public beta)
8. FreeSWITCH smoke CI as required gate
9. Visual IVR builder: publish diff + rollback UI
10. Multi-instance rate limiting production evidence (Redis or edge config)
11. SDK publish readiness (`main`, `types`, `exports`, extended client)
12. Tenant isolation matrix: recordings, security alerts, fraud policy
13. CHANGELOG and release governance

### Long-term (production)
14. Restore rehearsal and soak test evidence
15. Carrier interop evidence
16. Release evidence bundle
17. Full monitoring, alerting, on-call runbooks

---

## 19. GitHub Issues Created

See issues created as part of this audit below. Issue numbers assigned after creation.

| Issue | Priority | Title |
|---|---|---|
| TBD | P0 | [release][P0] README has stale test and OpenAPI operation counts |
| TBD | P0 | [release][P0] .env.example missing RUNTIME_API_TOKEN_SECONDARY |
| TBD | P1 | [runtime][P1] FreeSWITCH smoke CI not in required CI gate |
| TBD | P1 | [release][P1] Security alert management UI missing from admin panel |
| TBD | P1 | [release][P1] Retention policy and legal hold UI missing from admin panel |
| TBD | P1 | [coverage][P1] Web frontend coverage at 53% — below 80% beta target |
| TBD | P2 | [release][P2] docker-compose ALLOW_RUNTIME_TOKEN_FALLBACK defaults to true |
| TBD | P2 | [release][P2] SDK not npm-publishable — missing main/types/exports |
| TBD | P2 | [security][P2] In-memory rate limiter unsafe for multi-instance production |
| TBD | P2 | [release][P2] No GitHub release tags, CHANGELOG, or release notes policy |

---

## 20. Commands Run and Results

```
pnpm build                          PASS
pnpm lint                           PASS (1 pre-existing web warning)
pnpm test                           PASS  683 tests, 58 files
pnpm test:coverage                  PASS  API 68%/80%/70%, Web 53%/71%/59%, MCP 84%/80%/96%, SDK 99%
pnpm check:api-key-capabilities     PASS
pnpm check:webhook-payloads         PASS  17 events
pnpm check:mcp-schemas              PASS  16 tools
pnpm check:mcp-contracts            PASS  61 MCP tests
pnpm generate:openapi               PASS  199 components, 75 paths, 99 operations
node scripts/check-openapi-coverage PASS  99 operations, all with error response
node scripts/check-secrets.mjs      PASS  749 files
node scripts/check-migration-order  PASS  44 files, 41 prefixes, 3 noop shims
node scripts/check-ivr-simulation   PASS  92 IVR tests
node scripts/check-coverage-ignores PASS
node scripts/check-production-readiness PASS
node scripts/check-db-contracts     PASS  11 columns
node scripts/check-db-constraints   PASS  26 checks
node scripts/rate-limit-topology-check  WARN  4 non-default-value warnings
go test ./... -cover (freeswitch-agent) PASS  (main 0%, others 55–100%)
node scripts/check-freeswitch-profile   SKIP  requires FREESWITCH_ESL_PASSWORD
node scripts/carrier-interop-check      SKIP  requires --evidence=<file>
node scripts/release-evidence-check     SKIP  requires --manifest=<file>
pnpm production:e2e                     SKIP  requires live FreeSWITCH deployment
pnpm production:soak                    SKIP  requires live FreeSWITCH deployment
pnpm restore:smoke                      SKIP  requires live deployment and backup
```

---

## 21. Known Limitations

1. **FreeSWITCH build time:** The Dockerfile compiles FreeSWITCH from source (~10–25 min). Pre-built packages would improve developer experience.
2. **Rate-limit topology:** Redis shared-store support exists, but production deployments must still provide Redis or edge-gateway evidence.
3. **One agent per tenant:** The Go FreeSWITCH agent is configured with a single `MANAGECALLAI_TENANT_ID`. Multi-tenant FreeSWITCH setups require one agent per tenant or a routing proxy.
4. **`mod_xml_curl` timeout sensitivity:** If the API is slow or unreachable, FreeSWITCH falls back to its default behavior. This is documented but not tested for graceful fallback in CI.
5. **No SMS/voice-over-IP provider integration:** Channel accounts exist for future PSTN/SMS providers but no provider adapter is implemented.
6. **No end-to-end media handling:** RTP and media are fully delegated to FreeSWITCH. Recording download is via `GET /:id/playback` streaming the file from a local directory.
7. **SDK covers 6 of 99 API endpoints.** The SDK is a typed foundation, not a complete client.
8. **Visual IVR builder publish diff and rollback state UI** are documented as missing in `public-alpha-readiness.md`.

---

## 22. Recommendation: Release / Do Not Release

### Internal alpha: **RELEASE** ✅

All required gates pass. Demo loop is runnable. Architecture is sound. CI is green. No security blockers. Fix the two P0 items (README counts, `.env.example`) before announcing publicly, but internal evaluation can start now.

### Public alpha: **DO NOT RELEASE YET** ⚠️

Fix the two P0 issues first. Then tag `v0.1.0-alpha`. The project is very close.

### Public beta: **DO NOT RELEASE** ❌

FreeSWITCH smoke CI, IVR builder UI gaps, frontend coverage, rate-limit topology evidence, SDK publish readiness, and tenant isolation matrix coverage must all be addressed.

### Production: **DO NOT RELEASE** ❌

All beta gates plus restore rehearsal, soak tests, carrier interop, release evidence bundle, and monitoring/alerting required.

---

*Audit completed 2026-06-01. All findings are based on verified code, CI results, and script outputs — no speculative claims.*
