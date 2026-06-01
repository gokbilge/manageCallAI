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
deployment hardening, visual IVR builder polish, observability HUD polish, and
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

### Blocker 3: visual IVR and observability are not release-grade product surfaces

The backend lifecycle is strong. Product readiness still depends on the
operator-facing surfaces being usable by non-developers:

- visual IVR authoring
- live observability HUD
- approval/publish/rollback workflows
- error/loading/empty states
- accessibility and role-aware navigation

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
| Public beta | Not ready | Self-hosted FreeSWITCH smoke CI, usable visual builder/HUD, broader isolation/runtime tests |
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

- [ ] Self-hosted FreeSWITCH smoke CI.
- [ ] First usable visual IVR builder release surface.
- [ ] First usable observability HUD release surface.
- [ ] Tenant isolation matrix tests across major domains.
- [ ] Runtime actor boundary tests.
- [ ] Webhook signing, replay, and idempotency docs/tests.
- [ ] n8n example workflows verified.
- [ ] MCP setup and capability matrix docs verified.
- [ ] SDK generated and published or clearly versioned.
- [ ] API coverage at or above 80%.
- [ ] Web coverage at or above 65-70%.
- [ ] MCP coverage at or above 70-75%.
- [ ] Go agent coverage at or above 70%.
- [ ] Single-server alpha deployment doc tested.

## Production Checklist

- [ ] FreeSWITCH E2E smoke runs in CI or a required self-hosted release gate.
- [ ] SIP/TLS/SRTP/NAT deployment guide tested.
- [ ] Backup/restore tested.
- [ ] Upgrade and migration playbook tested.
- [ ] Outbound toll-fraud controls tested.
- [ ] Recording/CDR/voicemail retention policy enforced or explicitly operated.
- [ ] Multi-instance rate limiting uses Redis, edge enforcement, or another external store and passes `pnpm production:rate-limit-check`.
- [ ] Structured logs with redaction verified.
- [ ] Telecom threat model complete.
- [ ] Load/soak test for call events and runtime ingestion passes with sanitized `pnpm production:soak` evidence.
- [ ] Runtime lookup SLO evidence passes `pnpm production:slo-check -- --evidence=<file>`.
- [ ] Carrier interop evidence passes `pnpm carrier:interop-check -- --evidence=<file>`.
- [ ] Release evidence bundle passes `pnpm release:evidence-check -- --manifest=<file>`.
- [ ] Platform admin and tenant admin runbooks.
- [ ] Rollback procedure tested.
- [ ] Release checklist completed.
