# Changelog

All notable changes to manageCallAI are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Pre-1.0 versions use `0.MINOR.PATCH`. Alpha/beta releases carry numbered
pre-release suffixes: `0.1.0-alpha.1`, `0.2.0-beta.1`, etc.

---

## [Unreleased]

### Added
- Runtime token and JWT rotation rehearsal evidence validation for beta and
  production release gates (closes #94).
- FreeSWITCH agent startup-path tests covering smoke-check mode, invalid
  startup config, connect failure, and graceful shutdown (closes #104).
- Release checklist tag governance for alpha, beta, RC, and production channels
  (closes #105).
- Security alert management UI (`/tenant/security-alerts`) -- view, acknowledge, resolve, dismiss alerts; manage alert rules (closes #54).
- Compliance / retention UI (`/tenant/compliance`) -- tenant retention policy and legal hold management (closes #55).
- Release notes policy for versioned GitHub releases, changelog updates, and SDK publish status (closes #71).
- Visual IVR detail workflow coverage for draft editing, validate, publish, read-only version states, and empty builder state (closes #72).
- Redis-backed API rate-limit store for multi-instance production deployments.

### Fixed
- `docker-compose.yml` `ALLOW_RUNTIME_TOKEN_FALLBACK` default changed from `true` to `false` -- the API already defaults to `false` in production; the compose default now matches (closes #57).
- Production preflight now explicitly fails when `MANAGECALLAI_INSTANCE_COUNT > 1` without an external/edge rate limiter declared, and when `ALLOW_RUNTIME_TOKEN_FALLBACK=true` in production (closes #59).
- IVR flow integration tests no longer truncate shared tenant data before every test, reducing PostgreSQL deadlock risk in parallel runs (closes #70).

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

[Unreleased]: https://github.com/gokbilge/manageCallAI/compare/v0.1.0-alpha.1...HEAD
[0.1.0-alpha.1]: https://github.com/gokbilge/manageCallAI/releases/tag/v0.1.0-alpha.1
