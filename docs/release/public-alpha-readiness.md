# Public Alpha Readiness

## Release Recommendation

The current project is suitable for an internal alpha and can become a public
alpha after the alpha gates in this document are closed.

Recommended tag after those gates pass:

```text
v0.2.0-alpha
```

Until then, use:

```text
v0.1.0-alpha-candidate
```

Do not describe this project as production-ready yet.

## Positioning

manageCallAI is an alpha-stage AI-native FreeSWITCH control plane. Core API
domains, IVR lifecycle, MCP tools, automation hooks, and FreeSWITCH
XML/runtime foundations are implemented. The project is suitable for local
demos, internal evaluation, and contributor testing.

Production deployment is not recommended until full FreeSWITCH smoke CI,
deployment hardening, observability HUD polish, and
expanded tenant-isolation/runtime tests are complete.

## What Is Ready

### Core backend domains

The API implements the core telecom control-plane domains: auth, extensions,
SIP trunks, phone numbers, schedules, outbound routes, call groups, queues,
voicemail boxes, prompt assets, IVR lifecycle, inbound routes, runtime IVR,
outbound calls, call events, recordings, automation, users, approvals,
audit/export, channels, platform ops, FreeSWITCH integration, MCP, n8n
patterns, schema contracts, and the standard error model.

This is sufficient for internal alpha evaluation.

### Architecture direction

The architecture is aligned around:

```text
PostgreSQL desired state
  -> API validation, simulation, publish, rollback
  -> generated runtime artifacts
  -> stock FreeSWITCH runtime
```

FreeSWITCH remains runtime-only. The API owns desired state and safety
lifecycle. Lua remains thin. MCP and n8n stay narrower than REST.

### CI and quality gates

The project has mature early-stage CI gates:

- secret scanning
- TypeScript build
- lint
- dependency audit
- migration order and naming checks
- migration replay
- DB contract checks
- DB constraint/default checks
- OpenAPI generation and drift checks
- OpenAPI coverage checks
- tests
- Go tests
- MCP schema drift checks
- webhook payload coverage checks
- API-key capability alignment checks
- IVR simulation regression checks
- runtime XML golden-file tests
- Docker image builds

### Demo loop

The documented demo loop has two proof levels:

- API proof: auth, extension CRUD, directory endpoint, call-event ingest/query
- Runtime proof: API proof plus real SIP REGISTER through FreeSWITCH

## Not Ready Yet

### Blocker 1: full FreeSWITCH smoke test is not in normal CI

The normal GitHub-hosted CI path does not run FreeSWITCH as a runtime service
because SIP/media, host networking, startup timing, and FreeSWITCH runtime
requirements are not reliable in standard GitHub Actions service containers.

For public alpha this is acceptable if documented.

For beta and production, a self-hosted runner or dedicated smoke environment
must prove:

- API + PostgreSQL + FreeSWITCH + Go agent boot together
- directory lookup works
- dialplan lookup works
- SIP REGISTER works
- IVR runtime callback works
- event ingestion works
- call timeline and observability queries work

### Blocker 2: production deployment docs need an alpha-focused entry point

`docs/ops/production-deployment.md` exists and covers production concerns. A
public alpha still needs a simpler deployment entry point that tells evaluators
what is supported, what is not, and how to run a clean local/single-server
evaluation without implying production readiness.

### Blocker 3: observability and beta workflow proof are not release-grade product surfaces

The backend lifecycle is strong. Product readiness still depends on the
operator-facing surfaces being usable by non-developers:

- live observability HUD
- approval/publish/rollback workflows
- error/loading/empty states
- accessibility and role-aware navigation

The visual IVR builder is usable for the alpha authoring loop: draft editing,
validation, simulation, publish request, and read-only states for published or
non-editable versions. Beta still needs broader operator workflow evidence.

### Blocker 4: active CodeQL/security findings must be closed or triaged

Before public alpha, all high and medium CodeQL findings should be fixed or
triaged with a clear false-positive explanation. Rate limiting and sensitive log
redaction are especially important for telecom admin/runtime surfaces.

### Blocker 5: release-grade coverage is not reached across all packages

Recent coverage work improved SDK and MCP substantially, but API, Web, and Go
agent remain below release-grade targets. Public alpha can proceed with clear
alpha labeling. Production cannot.

## Release Category

| Category | Recommendation | Required Before Tag |
|---|---|---|
| Internal alpha | Ready | Main CI green, demo loop works locally, runtime proof verified manually |
| Public alpha | Almost ready | CodeQL triage, alpha docs, known limitations, clean-clone demo verification |
| Public beta | Not ready | Self-hosted FreeSWITCH smoke CI, usable observability HUD, broader isolation/runtime tests |
| Production | Not ready | Runtime E2E CI, deployment hardening, backup/restore/upgrade tests, fraud controls, soak testing |

## Public Alpha Checklist

- [x] All high/medium CodeQL alerts closed or triaged. -- No open alerts as of 2026-06-01.
- [x] General `/api/v1/*` fallback rate limit verified. -- `api` bucket covers all authenticated DB-backed routes; tested in `apps/api/src/security/rate-limit.test.ts`.
- [x] Sensitive runtime/SIP logging findings closed. -- `logError` omits stack traces; URL redaction strips `*_token` and `*secret` query params; tested in logger.test.ts.
- [x] README clearly says alpha and not production-ready. -- README "Current Status" section reads "Alpha candidate. Not production-ready."
- [x] Known limitations are documented. -- Listed in `docs/deployment/local-alpha.md` under Alpha Limitations.
- [x] Local alpha deployment doc exists. -- `docs/deployment/local-alpha.md`
- [ ] Local demo loop verified from a clean clone. -- Run manually before tagging `v0.2.0-alpha`.
- [ ] Runtime proof verified manually on one clean machine. -- Required before public tag; see live-freeswitch-*.md runbooks.
- [x] Docker images build successfully. -- CI docker-build job covers all 5 images on every PR.
- [x] DB migration replay and constraints pass. -- CI `db:migrate`, `db:contracts`, `db:constraints` run on every PR.
- [x] OpenAPI generation and drift checks pass. -- CI `generate:openapi` + drift check runs on every PR.
- [x] MCP schema drift check passes. -- CI `check:mcp-schemas` runs on every PR.
- [x] Webhook payload coverage check passes. -- CI `check:webhook-payloads` runs on every PR.
- [x] Security reporting process is visible. -- `SECURITY.md` is present at the repository root.

## Beta Checklist

- [x] Self-hosted FreeSWITCH smoke CI. -- Runner provisioned (`[self-hosted, freeswitch]`). Smoke run 26803056139 passed all gates (ESL, TLS, SRTP, production-E2E, hardening, SIP REGISTER, Go agent). **Remaining requirement:** a passing run must be tied to a `release/**` or `rc/**` branch (not a feature branch) before beta promotion.
- [x] First usable visual IVR builder release surface. -- Alpha route supports draft editing, validation, simulation, publish request, and read-only states for non-editable versions.
- [ ] First usable observability HUD release surface. -- **Still required before beta.** Live sessions, runtime errors, FreeSWITCH node health, and event timeline surfaces are not beta-grade.
- [x] Tenant isolation matrix fully covered. -- All 32 resources tested including outbound call requests; 41/41 matrix integration tests pass (PR #125).
- [x] Runtime actor boundary tests. -- Covered in `runtime-boundary.integration.test.ts`.
- [ ] Webhook signing, replay, and idempotency docs/tests. -- **Still required before beta.**
- [ ] n8n example workflows verified end-to-end. -- **Still required before beta.**
- [ ] MCP setup and capability matrix docs verified end-to-end. -- **Still required before beta.**
- [ ] SDK generated and published or clearly versioned. -- **Still required before beta.**
- [ ] API coverage at or above 80%. -- **Still required before beta.**
- [ ] Web coverage at or above 65-70%. -- **Still required before beta.**
- [ ] MCP coverage at or above 70-75%. -- **Still required before beta.**
- [ ] Go agent coverage at or above 70%. -- **Still required before beta.**
- [ ] Single-server alpha deployment doc tested. -- **Still required before beta.**

## Production Checklist

- [x] FreeSWITCH E2E smoke runs in required self-hosted release gate. -- Smoke run 26803056139 passed. Must be re-run on `release/**` or `rc/**` branch to satisfy the Release and RC smoke gate ruleset.
- [x] SIP TLS/SRTP/NAT deployment guide tested with evidence. -- Evidence at `docs/ops/sip-tls-srtp-nat.md`; smoke evidence `sip-tls-srtp-nat-evidence-2026-06-02T06-42-43Z.json` (validated). Two-way SRTP media is a documented warning (smoke client limitation).
- [x] Backup/restore tested with evidence. -- Restore rehearsal evidence passed via PR #116. Rehearsal interval: 30 days.
- [ ] Upgrade and migration playbook tested. -- **Still required before production.** `docs/ops/production-deployment.md` documents the plan; real upgrade rehearsal not yet evidenced.
- [ ] Outbound toll-fraud controls with evidence. -- Fraud policy API implemented and integration-tested; end-to-end carrier-level block/allow evidence not yet produced.
- [ ] Recording/CDR/voicemail retention API and legal hold endpoints. -- **Required before production.** DB schema and worker implemented; API endpoints for tenant overrides and legal hold management are missing (see `docs/ops/recording-voicemail-cdr-retention.md`).
- [ ] Multi-instance rate limiting with live evidence. -- `pnpm production:rate-limit-check` exits 0 but emits 4 warnings about missing explicit production limits. Scripted but not evidenced for a multi-instance deployment.
- [x] Structured logs with redaction verified. -- Log redaction check passes 20/20 test cases. Evidence at `artifacts/log-redaction/`.
- [ ] Telecom threat model complete. -- **Still required before production.**
- [x] Load/soak test evidence. -- 1800s soak: 0% failure, p95 8.78ms, p99 12.05ms (PR #116 / issue #100).
- [x] Runtime lookup SLO evidence. -- directory p95 12.8ms, dialplan p95 17.19ms (PR #116 / issue #100).
- [x] Carrier interop evidence. -- Lab evidence with 3 passed scenarios and 5 documented exceptions; requires re-test with live carrier before carrier traffic. Evidence: `docs/ops/carrier-interop-evidence-2026-06-02.json`.
- [x] Release evidence bundle validated. -- `docs/release/release-evidence-v0.1.0.json` passes `release-evidence-check.mjs`.
- [ ] Platform admin and tenant admin runbooks. -- **Still required before production.**
- [x] Rollback procedure documented. -- `docs/ops/production-deployment.md#upgrade-and-migration-playbook`.
- [ ] Full release checklist completed for target release version. -- **Still required before production.**
