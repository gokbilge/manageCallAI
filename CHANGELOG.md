# Changelog

All notable changes to manageCallAI are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Pre-1.0 versions use `0.MINOR.PATCH`. Alpha/beta releases carry numbered
pre-release suffixes: `0.1.0-alpha.1`, `0.2.0-beta.1`, etc.

---

## [Unreleased]

---

## [0.3.5] - 2026-06-04

Release classification: production release — setup, bootstrap, and deployment packaging.

Production evidence: `docs/release/release-evidence-v0.3.5.json`

### Added

- First-run setup/bootstrap (PR #189, #192):
  - `0052_system_config` migration — `setup_complete` sentinel
  - `GET /setup` wizard — self-contained HTML, locked after bootstrap
  - Headless bootstrap via `SETUP_ADMIN_EMAIL` + `SETUP_ADMIN_PASSWORD` env vars
  - `docker-compose.prod.yml` — production Compose using GHCR images
  - `.env.production.example` — all secrets with `openssl rand -hex 32` hints
  - `install.sh` — one-command VPS installer
  - Helm chart scaffold (`charts/managecallai/`) with migration Job, Secret, ConfigMap, Deployments, PVC, Ingress
  - Docker Hub publishing gate — conditional on `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` secrets
- Release process guide: `docs/ops/release-process.md`

### Fixed

- `setup.html not found` crash on container startup — build script now copies HTML to `dist/` after `tsc`
- `docker-images.yml` failing all matrix jobs when `DOCKERHUB_TOKEN` absent — Docker Hub login is now conditional

### Changed

- Core architecture and design docs aligned to implementation (PR #190)
- Workspace package versions aligned to `0.3.5`

### Upgrade notes

```sh
pnpm db:migrate   # applies 0052_system_config.sql
```

Review `.env.production.example` before using the setup/bootstrap path.

### Remaining operator steps before live-call activation

- Make GHCR packages public: GitHub → Profile → Packages → Change visibility
- Live rotation rehearsal: `pnpm rotation:rehearsal`
- Configure `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN` repo secrets

### Release references

- `docs/release/release-evidence-v0.3.5.json`
- `docs/release/release-evidence-v0.3.5-rc.1.json`
- `docs/ops/release-process.md`
- `docs/planning/open-release-blockers.md`

## [0.3.0] — 2026-06-03

First production release. All production gates passed. Live rotation rehearsal
and rate-limit topology proof completed on `enlogy@10.0.0.32`. FreeSWITCH smoke
run 26903877370 passed on `rc/v0.3.0`. Evidence:
`docs/release/release-evidence-v0.3.0.json` — `pnpm release:evidence-check`
exits 0. GitHub release: https://github.com/gokbilge/manageCallAI/releases/tag/v0.3.0

### Added

- **PBX Completeness Layer** — all six production features implemented (issues #172–#178):
  - Tenant-scoped feature codes with DTMF Lua callback, publish/rollback lifecycle,
    and audit trail (closes #172)
  - Call parking via `mod_valet_parking`: `parking_lots` desired-state table, Go agent
    `CHANNEL_PARK` event ingestion, slot retrieval path (closes #173)
  - Native conferencing via `mod_conference`: `conference_rooms` lifecycle, PIN
    enforcement, two-caller bridge path (closes #174)
  - Safe gateway reload on SIP trunk change: `runtime_apply_requests` table, Go agent
    ESL `sofia rescan`, REGED confirmation path (closes #175)
  - End-user self-service portal: `end_user` role, `/me/extension`, `/me/dnd`,
    `/me/call-forward` endpoints scoped to JWT sub, tenant capability policy, DND and
    call-forward audit events, cross-tenant isolation tests (closes #176)
  - FreeSWITCH runtime management Phase 1: Go agent status reporter (safe ESL reads
    every 30 s), `freeswitch_node_status_snapshots` table, platform admin
    status/modules/gateways/channels/registrations endpoints, tenant gateway-status
    endpoint (closes #177)
  - PBX evidence gates added to release checklist and `check:production-readiness`
    (closes #178); parent issue #171 closed
- **Retention storage cleanup** (closes #161):
  - `StorageBackend` interface + `LocalStorageBackend` (ENOENT-tolerant filesystem
    deletion, swappable for S3/GCS)
  - `RetentionPurgeService` now collects `storage_path` pre-purge for `recording` and
    `voicemail` categories and deletes files after DB records are removed; failures
    counted in audit metadata as `storage_delete_failures`, non-fatal
  - DSR / right-to-erasure procedure documented in
    `docs/ops/recording-voicemail-cdr-retention.md`: manual operator steps, data
    categories, accepted limitations (backup snapshots, cross-tenant CDRs)
  - Export-before-delete decision recorded: explicitly deferred with risk acceptance
- **RC and production evidence** (closes #162, #163, #164):
  - RC-topology SLO evidence (`docs/ops/runtime-slo-evidence-2026-06-03.json`):
    directory p99 15 ms, dialplan p99 22 ms, health/ready p99 8 ms — all within
    thresholds; `pnpm production:slo-check` exits 0
  - FusionPBX/NetGSM carrier interop 6/8 scenarios passed (sip_register, inbound_call,
    outbound_call, hangup_cdr, tls_or_documented_exception, nat_media_path);
    2 documented exceptions (dtmf_rfc2833, failover); `pnpm carrier:interop-check`
    exits 0
  - Live rotation rehearsal (`docs/ops/rotation-rehearsal-2026-06-03.json`):
    TOKEN_A → TOKEN_B with overlap window verified (both tokens accepted simultaneously),
    JWT_SECRET rotated concurrently, old token confirmed rejected;
    `pnpm check:runtime-token-rotation --evidence` exits 0
  - Log redaction scan of API container logs: 0 findings;
    `docs/ops/log-redaction-rotation-2026-06-03.json`
  - Network config evidence: all production env vars set, 0 findings in smoke context;
    `docs/ops/network-config-rc-v0.3.0.json`
  - Single-instance rate-limit topology proof on `enlogy@10.0.0.32`: `APP_ENV=production`,
    all `RATE_LIMIT_*` limits set, `pnpm production:rate-limit-check` exits 0
  - `rotation-rehearsal.mjs` script added: exercises live API token rotation and writes
    JSON evidence artifact; `--check-config` runs in smoke CI
  - `check-production-network-config.mjs` extended with `--json-output` flag; network
    config step in `freeswitch-smoke.yml` now eliminates all 4 previous warnings
  - Log redaction CI gate added to `freeswitch-smoke.yml`: scans API container logs
    after E2E run, uploads artifact, validates 0 findings
  - Evidence bundle validation hardened: placeholder-pattern detection, `github_release`
    field required for RC/production manifests, `log_redaction`, `rotation_rehearsal`,
    `network_config` fields required
  - RC evidence manifest `docs/release/release-evidence-v0.3.0-rc.1.json` (stage: rc)
  - Production evidence manifest `docs/release/release-evidence-v0.3.0.json` (stage:
    production) — all 18 required evidence fields reference real artifacts

### Changed

- `docs/ops/recording-voicemail-cdr-retention.md` — all acceptance criteria checked;
  DSR, export-before-delete, and storage deletion sections added
- `docs/planning/open-release-blockers.md` — updated to v0.3.0 production release;
  all production blockers closed
- `README.md` — stage table updated to production-ready; project posture updated

---

## [0.2.0-beta.1] — 2026-06-02

First public beta candidate. All beta-readiness implementation work has landed.
FreeSWITCH runtime smoke run 26825030902 passed all gates on self-hosted runner
(4m53s). Release evidence bundle passes `pnpm release:evidence-check`.
Production readiness requires further evidence — see
`docs/release/release-evidence-v0.2.0.json` for open production gates.

### Added

- FreeSWITCH gateway configuration via `mod_xml_curl`:
  - New `POST /api/v1/freeswitch/configuration` endpoint serves Sofia gateway XML
    for all active SIP trunks; credentials are decrypted on demand and never cached
  - `gateway.repository.ts` fetches all active trunks (all tenants, platform-level)
  - `buildGatewayConfiguration()` XML builder with golden-file tests (10 tests)
  - `xml_curl.conf.xml.example` now binds the `configuration` section
  - `entrypoint.sh` now injects `MANAGECALLAI_CONFIGURATION_URL` into FreeSWITCH config
- FreeSWITCH outbound call execution via ESL originate:
  - `esl/command_client.go` — dedicated one-shot ESL command connection for sending
    `bgapi originate` without interfering with the event subscription stream
  - `CommandClient.Originate()` wired as the `ESLDialer` in `main.go`
  - `OutboundDispatcher` now runs in `main.go` (was implemented but never started)
- Migration `0044_freeswitch_node_sip_profile.sql` — adds per-node SIP profile fields
  to `freeswitch_nodes`: `sip_domain`, `external_sip_ip`, `external_rtp_ip`,
  `sip_port`, `sip_tls_port`, `tls_enabled`, `srtp_policy`, `rtp_port_min/max`,
  `codec_prefs`, `dtmf_type`

### Fixed

- Outbound calls were queued via the API but never dispatched to FreeSWITCH because
  the `OutboundDispatcher` goroutine was not started in `main.go` and the
  `ESLDialer.Originate` interface had no concrete implementation

- `docs/design/ux-design.md` — design system reference: color tokens, typography,
  spacing, component patterns, brand assets, icon vocabulary, and UX principles
- Brand marks in `apps/web/public/` (light/dark SVGs, PNG/JPG square avatars);
  PNG set as browser favicon in `index.html`
- Google Fonts preconnect + stylesheet link in `index.html` for Inter 400–700 and
  JetBrains Mono 400–600 (tokens declared the fonts but did not load them)
- GitHub issues #157–#164 for open beta and production blockers

### Changed

- `docs/ui/UI_ARCHITECTURE.md` — added Section 13 "Implementation Status" recording
  the actual Tailwind v4 stack, design tokens, layout implementation, component
  inventory, feature page coverage, brand assets, and remaining beta-ready work
- `docs/architecture/overview.md` — Section 5.1 updated to reflect the React 18 +
  Tailwind v4 design system implementation, two-workspace model, and brand assets
- `docs/planning/open-release-blockers.md` — updated to reflect v0.2.0-beta.1 tag,
  closed issues, new GitHub issue links (#157–#164), and production evidence status
- API coverage thresholds raised: statements 64→67, branches 54→56, lines 66→67
  (measured from CI run 26834489441: 67.46% / 56.09% / 67.46%)

---

## [0.2.0-beta.1] — 2026-06-02

First public beta candidate. All beta-readiness implementation work has landed.
FreeSWITCH runtime smoke run 26825030902 passed all gates on self-hosted runner
(4m53s). Release evidence bundle passes `pnpm release:evidence-check`.
Production readiness requires further evidence — see
`docs/release/release-evidence-v0.2.0.json` for open production gates.

### Added

- Live carrier SIP trunk interoperability verified against FusionPBX/NetGSM
  (`ivr.velocize.com`, `sip.netgsm.com.tr`): SIP registration REGED, bidirectional
  SIP INVITE signaling confirmed, FreeSWITCH CDR written for all call attempts,
  inbound INVITE received with real NetGSM carrier caller-ID (+903124401820).
  Evidence: `docs/ops/carrier-interop-evidence-fusionpbx-2026-06-02.json` (closes #138).
- FreeSWITCH `from-domain` gateway parameter documented: required when FusionPBX
  domain differs from proxy IP (fixes SIP 403 Forbidden on registration).
- Retention API: `GET/PATCH /api/v1/tenant/retention` and
  `POST/DELETE/GET /api/v1/tenant/legal-hold(s)` — per-tenant retention policy
  management and full legal hold lifecycle with bounds validation, audit trail,
  and cross-tenant isolation (closes #136).
- FreeSWITCH node health panel in the observability live cockpit: active/total
  node count from the node registry with status copy for all health states
  (closes #131).
- Webhook signing, replay protection, and idempotency documentation
  (`docs/design/webhooks.md`) with Node.js verification example (closes #132).
- n8n setup guide (`docs/ops/n8n-setup.md`) covering all 10 example workflows,
  credential configuration, and signature verification (closes #133).
- MCP setup guide (`docs/ops/mcp-setup.md`): env vars, capability matrix, all
  tool categories, security constraints (closes #134).
- SDK usage guide (`docs/ops/sdk-usage.md`): installation, quick start,
  versioning policy, publish workflow (closes #135).
- Recommended production values for all `RATE_LIMIT_*` env vars documented in
  `docs/ops/rate-limit-topology.md` (closes #139).
- Upgrade and migration rehearsal evidence template
  (`docs/ops/upgrade-rehearsal-evidence.md`) with step-by-step procedure and
  JSON evidence record format (closes #140).
- Release evidence bundle `docs/release/release-evidence-v0.2.0.json` with all
  beta gates evidenced and production-gate status documented (closes #150).
- Product release audit `docs/release/product-release-audit.md` with full
  validation results, per-area blocker tables, and remaining production gates.
- Issue templates: beta_blocker, production_blocker, evidence_gate,
  security_hardening forms.

### Changed

- Clarified current release posture as public beta candidate, not production
  ready; added a product release audit with strict evidence rules.
- API coverage thresholds raised (62/52/64/64 → 64/54/66/66); beta exception
  documented with 70% beta-GA and 80% RC follow-up targets (closes #141).
- `docs/ops/recording-voicemail-cdr-retention.md` updated to reflect completed
  retention API endpoints and integration tests.
- CHANGELOG duplicate `[Unreleased]` section removed; footer links updated.

### Known limitations

- Production gates remain open: restore/upgrade rehearsal, SLO/soak (target
  topology), multi-instance rate limiting, retention storage/export/DSR,
  network hardening (target env), fraud controls (carrier-level), release
  evidence bundle operator signoff for production.
- SDK npm publish has not been exercised in a tagged release.
- n8n and MCP end-to-end proof required for beta-ready promotion.
- FreeSWITCH smoke runs on the self-hosted runner, not in standard hosted CI.

### Smoke evidence (run 26825030902)

All steps passed in 4m53s on `enlogy@10.0.0.32` (self-hosted runner):

- API + PostgreSQL + FreeSWITCH + Go agent boot
- DB migrations, contracts, constraints
- FreeSWITCH ESL ready (port 8021)
- FreeSWITCH TLS port ready (port 5081)
- ESL profile check
- Production runtime E2E (tenant, extension, directory, dialplan, IVR lifecycle)
- SIP REGISTER smoke (UDP + TLS)
- Go agent ESL connection smoke
- Observability query smoke
- FreeSWITCH hardening check (0 findings)
- SIP TLS / SRTP / NAT smoke
- Evidence artifact validated and uploaded (`freeswitch-smoke-26825030902`)

---

## [0.2.0-alpha] -- 2026-06-02

Public alpha. All public alpha gates are now closed. Clean-clone demo loop
verified. CI smoke gate infrastructure provisioned with passing run.
Production-readiness slices (#90–#103) closed with lab evidence.

### Added

- Complete tenant isolation test coverage: 41/41 rbac-matrix integration
  tests pass including outbound call request queue isolation (closes #91).
- FreeSWITCH SIP TLS/SRTP/NAT evidence from self-hosted smoke run 26803056139:
  TLS REGISTER and SRTP-negotiated INVITE pass on external profile (closes #92).
- FreeSWITCH hardening evidence from smoke run (closes #93).
- Carrier interoperability evidence with lab SIP trunk: sip_register,
  tls_or_documented_exception, nat_media_path passed; 5 scenarios documented
  as exceptions requiring live carrier re-test (closes #101).
- Release evidence bundle manifest `docs/release/release-evidence-v0.1.0.json`
  validated by `release-evidence-check.mjs` (closes #103).
- Recording/voicemail/CDR/transcript retention policy documentation
  (`docs/ops/recording-voicemail-cdr-retention.md`) with accurate
  implementation status.
- Open release blockers index (`docs/planning/open-release-blockers.md`).
- Runtime token and JWT rotation rehearsal evidence validation for beta and
  production release gates (closes #94).
- FreeSWITCH agent startup-path tests covering smoke-check mode, invalid
  startup config, connect failure, and graceful shutdown (closes #104).
- Release checklist tag governance for alpha, beta, RC, and production channels
  (closes #105).
- Security alert management UI (`/tenant/security-alerts`) — view, acknowledge,
  resolve, dismiss alerts; manage alert rules (closes #54).
- Compliance / retention UI (`/tenant/compliance`) — tenant retention policy
  and legal hold management (closes #55).
- Release notes policy for versioned GitHub releases, changelog updates, and
  SDK publish status (closes #71).
- Visual IVR detail workflow coverage for draft editing, validate, publish,
  read-only version states, and empty builder state (closes #72).
- Redis-backed API rate-limit store for multi-instance production deployments.

### Fixed

- `docker-compose.yml` `ALLOW_RUNTIME_TOKEN_FALLBACK` default changed from
  `true` to `false` — the API already defaults to `false` in production; the
  compose default now matches (closes #57).
- Production preflight now explicitly fails when `MANAGECALLAI_INSTANCE_COUNT
  > 1` without an external/edge rate limiter declared, and when
  `ALLOW_RUNTIME_TOKEN_FALLBACK=true` in production (closes #59).
- IVR flow integration tests no longer truncate shared tenant data before every
  test, reducing PostgreSQL deadlock risk in parallel runs (closes #70).

### Demo loop result (2026-06-02)

API proof (no FreeSWITCH required) executed on `main` at commit `HEAD`:

- `pnpm install --frozen-lockfile` ✅
- `pnpm build` ✅ (all packages)
- `pnpm db:migrate` ✅ (no pending)
- Tenant registration → extension CRUD → directory XML → call-event ingest
  (HTTP 201) → call-event query (count:1, type:registration_seen) ✅

Runtime proof: CI smoke run 26803056139 passed SIP REGISTER (UDP + TLS),
Go agent ESL, production E2E, and all hardening checks.

### Alpha limitations (unchanged)

- No normal GitHub-hosted CI job boots full FreeSWITCH runtime.
- Multi-instance production rate limiting requires an external store.
- Carrier interop is lab-only; live carrier re-test required before
  enabling carrier traffic.
- Two-way SRTP media path not verified in smoke (SRTP negotiation confirmed;
  actual media encryption requires SRTP-capable smoke client).
- Observability HUD, webhook signing, n8n/MCP verification, and SDK
  publishing are required before beta (see open issues #131–135, #141).

---

## [0.1.0-alpha.1] -- 2026-06-01

First public alpha candidate. Internal alpha validated. Core backend, IVR lifecycle,
MCP, n8n, and CI quality gates all passing.

### Added

#### Core telecom control plane
- Multi-tenant auth: register, login, JWT with role claim, platform admin support.
- Extensions: CRUD with AES-256-GCM encrypted SIP credentials at rest.
- SIP trunks, phone numbers, schedules, outbound routes: full CRUD.
- Call groups and queues: CRUD with simultaneous/sequential ring strategies.
- Voicemail boxes: CRUD with greeting prompt assignment.
- Prompt assets: metadata CRUD, provider-neutral TTS generation contract.
- Inbound routes: draft â†’ publish lifecycle with version control.

#### IVR lifecycle
- IVR flows: draft â†’ validate â†’ simulate â†’ publish â†’ rollback.
- Approval gating for publish/rollback.
- Branch simulation with node-coverage tracking.
- Version history and diff.
- Visual IVR builder with validation, simulation, and publish panels.

#### Runtime
- FreeSWITCH integration via `mod_xml_curl` directory and dialplan endpoints.
- Go ESL agent for event forwarding and outbound call dispatch.
- IVR runtime session start/advance over Lua thin executor.
- HMAC-signed FreeSWITCH node registry (SLICE-43).

#### Safety and policy
- Outbound call safety: global emergency/premium-rate blocks, route-level allow/block lists, per-route rate cap.
- Tenant fraud policy: country/area-code allowlists, tenant-level blocklists, per-hour/day call caps (SLICE-45).
- Security alert rules: 6 alert types, cooldown, evaluate endpoint (SLICE-48).
- Recording retention policy and legal holds (SLICE-47).

#### Automation
- API key management with explicit capability scoping.
- Webhook subscriptions with HMAC-SHA256 signing, replay protection, DLQ, and durable delivery queue.
- 9 importable n8n workflow templates.

#### Observability
- Live tenant snapshot SSE stream.
- Platform runtime health endpoint.
- Tenant audit log and data export.

#### MCP
- 16 MCP tools for AI agents (read, draft mutation, validate, simulate, approve, export).
- Contract drift checks in CI.

#### Security
- Runtime auth: Bearer/Basic/header token; secondary token for zero-downtime rotation; query/body fallback disabled in production.
- Production secrets enforcement: rejects defaults and weak values at startup.
- Webhook signing, replay-window verification, idempotency records.
- XML injection and regex escaping tested with golden files.

#### CI
- 20+ CI checks: build, lint, secret scan, dependency audit, migration order, DB contracts/constraints, OpenAPI drift, webhook payload coverage, API key alignment, IVR simulation regression, runtime XML golden tests, MCP contract drift, coverage, Docker builds, CodeQL.
- FreeSWITCH smoke CI workflow (self-hosted runner, optional for standard PRs).

#### Documentation
- Demo loop, production deployment guide, backup/restore playbook.
- SIP/NAT/TLS/SRTP guidance, MCP setup, n8n guide.
- Production preflight, soak, SLO, carrier interop scripts.
- Release readiness audit (docs/release/release-readiness-audit.md).

### Known limitations
- Multi-instance deployments require `RATE_LIMIT_STORE=redis`, another external limiter, or edge-enforced rate limits.
- FreeSWITCH smoke CI requires a self-hosted runner; not in standard hosted CI gate.
- SDK package is generated, buildable, and tested; public npm publish has not been exercised in a tagged release.
- Security alerts, retention/legal hold admin UI pages absent from this release.
- Visual IVR builder supports the alpha authoring workflow; beta still needs broader operator workflow validation.

[Unreleased]: https://github.com/gokbilge/manageCallAI/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/gokbilge/manageCallAI/compare/v0.2.0-beta.1...v0.3.0
[0.2.0-beta.1]: https://github.com/gokbilge/manageCallAI/compare/v0.2.0-alpha...v0.2.0-beta.1
[0.2.0-alpha]: https://github.com/gokbilge/manageCallAI/compare/v0.1.0-alpha.1...v0.2.0-alpha
[0.1.0-alpha.1]: https://github.com/gokbilge/manageCallAI/releases/tag/v0.1.0-alpha.1
