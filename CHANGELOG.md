# Changelog

All notable changes to manageCallAI are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Pre-1.0 versions use `0.MINOR.PATCH`. Alpha/beta releases carry a pre-release
suffix: `0.1.0-alpha`, `0.2.0-beta.1`, etc.

---

## [Unreleased]

### Added
- Security alert management UI (`/tenant/security-alerts`) — view, acknowledge, resolve, dismiss alerts; manage alert rules (closes #54).
- Compliance / retention UI (`/tenant/compliance`) — tenant retention policy and legal hold management (closes #55).

### Fixed
- `docker-compose.yml` `ALLOW_RUNTIME_TOKEN_FALLBACK` default changed from `true` to `false` — the API already defaults to `false` in production; the compose default now matches (closes #57).
- Production preflight now explicitly fails when `MANAGECALLAI_INSTANCE_COUNT > 1` without an external/edge rate limiter declared, and when `ALLOW_RUNTIME_TOKEN_FALLBACK=true` in production (closes #59).

---

## [0.1.0-alpha] — 2026-06-01

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
- Inbound routes: draft → publish lifecycle with version control.

#### IVR lifecycle
- IVR flows: draft → validate → simulate → publish → rollback.
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
- In-process rate limiter is per-process — not safe for multi-instance deployments without an edge/external limiter.
- FreeSWITCH smoke CI requires a self-hosted runner; not in standard hosted CI gate.
- SDK covers 6 of 99 API endpoints; not npm-publishable yet.
- Security alerts, retention/legal hold admin UI pages absent from this release.
- Visual IVR builder publish diff and rollback state UI are not yet implemented.

[Unreleased]: https://github.com/gokbilge/manageCallAI/compare/v0.1.0-alpha...HEAD
[0.1.0-alpha]: https://github.com/gokbilge/manageCallAI/releases/tag/v0.1.0-alpha
