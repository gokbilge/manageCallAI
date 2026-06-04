# Product Release Audit

> **SUPERSEDED.** This audit was conducted on 2026-06-02 at commit `30c0523`
> and found the project to be a "Public beta candidate." It is preserved as
> historical record only.
>
> **Historical evidenced production tag:** `v0.3.0` (2026-06-03, commit `1220e39`).
> Evidence: `docs/release/release-evidence-v0.3.0.json`.
> This file is preserved as historical record and is not a `v0.3.5` release audit.

---

Audit date: 2026-06-02

Audited repository: `gokbilge/manageCallAI`

Audited commit: `30c0523` on `main`

This audit was conducted by full inspection of all documentation, architecture
files, implementation structure, and release scripts, followed by execution of
all non-environment-dependent validation commands. Evidence rules are strictly
applied: scripts, templates, and `--check-config` output do not count as
release evidence unless they produce an artifact tied to the release-candidate
commit.

---

## Release stage decision

```markdown
# Release Stage Decision

Decision: Public beta candidate

Reason: Public alpha evidence exists for v0.2.0-alpha, and current main
contains beta-readiness implementation work (observability cockpit, retention/legal
hold APIs, webhook/MCP/n8n docs, SDK workflow, carrier evidence, rate-limit
documentation). The repository is not public beta ready until all beta evidence
gates are tied to the intended beta candidate commit or tag. It is not
production-ready until every production evidence gate passes with real artifacts
tied to the release candidate commit.

Highest-risk blocker: The v0.2.0 release evidence manifest still contains
placeholders for the RC commit, smoke run URL, CI/coverage evidence, restore/upgrade
evidence, SLO/soak evidence, rate-limit evidence, security evidence, and operator
signoff. No current-candidate-bound evidence bundle exists.

Next required step: Identify or cut the beta candidate commit (e.g., v0.2.0-beta.1),
run the candidate-bound evidence gates (FreeSWITCH smoke on release/** branch,
coverage report, SDK dry-run, MCP/n8n/webhook proofs), update
docs/release/release-evidence-v0.2.0.json, and validate with
pnpm release:evidence-check.
```

---

## Executive summary

manageCallAI has a coherent product architecture and a broad, consistent
implementation. The REST API, React admin UI, contracts/OpenAPI/SDK, MCP server,
n8n patterns, FreeSWITCH runtime integration, Go ESL agent, Lua thin executor,
retention/legal hold, fraud policy, observability cockpit, and release-gate
scripts all exist and are wired together.

The product should be described as a **public beta candidate**. The remaining
risk is not primarily missing code. It is:

1. Missing current release evidence tied to the candidate commit.
2. A few production operations gaps (storage deletion/export-before-delete,
   operator signoff, target deployment proof for network hardening and multi-instance
   rate limiting).
3. Integration tests require a running PostgreSQL instance that was not available
   in this audit environment.

---

## Validation commands run in this audit

| Command | Result | Notes |
|---|---|---|
| `pnpm install --frozen-lockfile` | ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ passed | Already up to date |
| `pnpm build` | ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ passed | All packages including web, api, mcp, worker |
| `pnpm lint` | ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ passed | contracts, sdk, web, api, mcp, worker |
| `pnpm test` | ÃƒÂ¢Ã‚ÂÃ…â€™ ECONNREFUSED :5432 | No PostgreSQL available in audit env; not a code defect |
| `pnpm generate:openapi` | ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ passed | 75 path entries, 199 schema components |
| `pnpm check:mcp-schemas` | ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ passed | 16 tools verified against contracts |
| `pnpm check:mcp-contracts` | ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ passed | MCP contract drift check passed |
| `pnpm check:webhook-payloads` | ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ passed | 17 events covered |
| `pnpm check:api-key-capabilities` | ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ passed | Capability alignment verified |
| `pnpm check:coverage-ignores` | ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ passed | Coverage ignore governance passed |
| `pnpm check:production-readiness` | ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ passed | Check-config mode only ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â not release evidence |
| `pnpm check:log-redaction` | ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ passed | 20/20 redaction test cases |
| `pnpm check:runtime-token-rotation` | ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ passed | No active rotation in this env |
| `pnpm check:network-config` | ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ passed (4 warnings) | NAT/RTP/SRTP env vars not set ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â expected in dev |
| `pnpm check:freeswitch-hardening` | ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ passed | 0 findings |
| `pnpm production:preflight` | ÃƒÂ¢Ã‚ÂÃ…â€™ fails (10 blocking) | Missing production env vars ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â expected in dev, not a code defect |
| `pnpm production:rate-limit-check` | ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ passed (4 warnings) | Explicit production rate limits not configured ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â expected in dev |
| `pnpm release:evidence-check -- --check-config` | ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ passed | Config wiring only ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â not release evidence |

Commands not run (require environment):

| Command | Reason | Impact |
|---|---|---|
| `pnpm test:coverage` | No PostgreSQL available | Cannot verify current coverage numbers |
| `pnpm db:migrate` | No PostgreSQL available | Cannot verify migration replay |
| `pnpm db:contracts` | No PostgreSQL available | Cannot verify schema contracts |
| `pnpm db:constraints` | No PostgreSQL available | Cannot verify constraint defaults |
| `pnpm test:scripts` | Not attempted | Script-level tests not verified this session |
| `pnpm production:e2e` | No live runtime environment | Production E2E not a check-config check |
| `pnpm production:soak` | No live runtime environment | Soak/load not executable locally |
| `pnpm production:slo-check` | No live runtime environment | SLO validation requires evidence artifact |
| `pnpm carrier:interop-check` | No live carrier environment | Carrier proof requires runtime |
| `pnpm restore:rehearsal` | No PostgreSQL/pg_dump available | Restore rehearsal requires DB tooling |
| `./scripts/local-runtime-release-gate.sh` | No FreeSWITCH runtime | Requires full runtime stack |
| `cd apps/freeswitch-agent && go test ./... -cover` | Go environment not verified | Would need go toolchain available |

---

## Product scope audit

| Area | Status | Release blocker |
|---|---|---|
| Auth (multi-tenant register/login, JWT, platform admin) | implemented | no |
| Tenants | implemented | no |
| Users/RBAC (tenant CRUD + role management) | implemented | no |
| Extensions (CRUD + AES-256-GCM SIP credentials) | implemented | no |
| SIP trunks | implemented | no |
| Phone numbers (DID inventory) | implemented | no |
| Schedules (time-based routing) | implemented | no |
| Inbound routes (draft ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ publish lifecycle) | implemented | no |
| Outbound routes + policy | implemented | no |
| Call groups (simultaneous/sequential ring) | implemented | no |
| Queues (CRUD + member management) | implemented | no |
| Voicemail boxes/messages | implemented | production: storage/retention evidence |
| Prompt assets (metadata + TTS contract) | implemented | production: media-retention evidence |
| IVR flows (draftÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢validateÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢simulateÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢publishÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢rollback) | implemented | RC runtime evidence |
| IVR publish/rollback/approval lifecycle | implemented | beta: UX/candidate evidence |
| Runtime IVR sessions (Lua executor loop) | implemented | RC runtime evidence |
| FreeSWITCH directory/dialplan callbacks | implemented | RC smoke evidence |
| Call events (Go ESL agent + query) | implemented | RC runtime evidence |
| Recordings (metadata + analysis contract) | implemented | production: storage/export evidence |
| Automation API keys (capability-scoped) | implemented | no |
| Webhooks (HMAC signing, replay, DLQ, durable delivery) | implemented | beta: candidate evidence |
| Channels (WhatsApp/Telegram/Google Meet adapters) | partially implemented | not beta blocker; provider adapters remain external |
| Observability (live SSE snapshot + cockpit) | implemented (beta-candidate surface) | beta: evidence from running stack |
| Fraud/outbound policy (country/area-code, caps) | implemented | production: carrier-level fraud evidence |
| Platform node registry (HMAC runtime auth) | implemented | production: runtime-node evidence |
| Export (tenant data export) | implemented | production: export-before-delete gap |
| MCP (16 safe AI tools) | implemented | beta: setup evidence |
| SDK (generated from OpenAPI) | implemented/generated | beta: publish/dry-run evidence |
| n8n (webhook trigger + API patterns, 10 workflows) | documented/examples | beta: end-to-end evidence |
| Idempotency | implemented | no |
| Audit events | implemented | no |
| Security alerts (6 alert types) | implemented | production: alert/runbook evidence |
| Retention policies and legal hold | implemented (DB + API + worker) | production: storage cleanup/DSR evidence |

---

## Architecture audit

| Area | Status | Notes |
|---|---|---|
| Monorepo structure | accurate | `apps/*`, `packages/*`, `db/`, `scripts/`, `docs/` all present and documented |
| API boundary | accurate | API owns desired state, lifecycle, auth, audit, simulation |
| PostgreSQL desired state | accurate | 43 migrations, all sequential, docs match schema |
| FreeSWITCH runtime-only role | accurate | Stock FreeSWITCH via `mod_xml_curl`, ESL, Lua only |
| Lua thin executor | accurate | Sanitizes bounded args, calls runtime APIs, no policy |
| Go FreeSWITCH agent | accurate | ESL connectivity, event forwarding, health; no tenant policy |
| `mod_xml_curl` integration | accurate | Directory + dialplan endpoints implemented in `modules/freeswitch` |
| Runtime auth | accurate | Bearer/Basic + node HMAC model; secondary token for rotation |
| MCP/n8n boundary | accurate | Safe API abstractions only; no raw ESL/XML/shell surface |
| Contracts/OpenAPI generation | accurate | Zod ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ OpenAPI; drift-checked in CI; 75 paths, 199 components |
| SDK generation | accurate | Generated from OpenAPI; publish workflow exists |
| Webhook delivery worker | accurate | Currently colocated in API process; noted as known tradeoff |
| Retention model | accurate (production gaps) | Policy + DB + worker exist; storage cleanup/export-before-delete not evidenced |
| Rate-limit model | accurate | Memory (single), Redis (multi), edge (external); production topology not evidenced |
| Production evidence model | accurate | Source-of-truth doc explicitly states: scripts/templates/check-config are not evidence |

High-level architecture diagram is current and matches the implementation data flow:

```text
React Web UI
   -> REST API (Fastify/Node.js)
      -> PostgreSQL desired state
      -> validation / simulation / publish / rollback / audit
      -> runtime artifact generation
      -> FreeSWITCH mod_xml_curl directory/dialplan
      -> Lua thin executor
      -> Go ESL agent
      -> call events / observability

MCP / n8n
   -> safe API abstractions only
```

---

## UI/operator audit

| UI area | Status | Problem | Required before beta | Required before production |
|---|---|---|---|---|
| Navigation | implemented | none found in audit | candidate UX evidence | operator signoff |
| Role-aware navigation | implemented | depends on capability matrix staying current | candidate test evidence | tenant isolation evidence |
| Alpha/beta status visibility | implemented | banner copy needs update when beta tag is cut | update copy at beta tag | release status policy |
| Visual IVR builder | implemented | complex workflow; no release screenshots attached | candidate evidence | operator signoff |
| Validation feedback | implemented | no candidate evidence attached | candidate run evidence | production runtime evidence |
| Simulation feedback | implemented | no candidate evidence attached | candidate run evidence | production runtime evidence |
| Publish request UX | implemented | approval edge cases need candidate proof | evidence | production signoff |
| Rollback UX | implemented | dangerous action confirmation needs evidence | evidence | production signoff |
| Approval UX | implemented | needs beta workflow proof | evidence | evidence |
| Observability HUD (live cockpit) | implemented | near-real-time snapshot; not raw stream | evidence from running stack | SLO/runtime evidence |
| Live call/session visibility | implemented | relies on runtime data from ESL agent | smoke evidence | production runtime evidence |
| FreeSWITCH node health panel | implemented | target deployment proof required | candidate proof | production node evidence |
| Runtime errors | partially implemented | summarized failures; no full incident workflow | beta evidence | alert/runbook evidence |
| Empty/loading/error states | implemented in audited pages | per-page review should continue | candidate UI evidence | operator signoff |
| Accessibility basics | partially implemented | no full a11y audit evidence | targeted checks | formal review |
| Dangerous action confirmations | partially implemented | rollback/publish need beta evidence | UX proof | production signoff |
| Copywriting consistency | partially implemented | alpha/beta wording needs release-stage cleanup | beta copy pass | release copy review |

---

## Security/isolation audit

| Area | Status | Remaining risk |
|---|---|---|
| Tenant isolation | implemented and matrix-tested (41/41) | keep evidence current for candidate |
| Runtime actor boundaries | implemented | RC runtime-node evidence required |
| API key capabilities | implemented/drift-checked (CI: passes) | no current blocker |
| Platform admin boundaries | implemented | verify in candidate CI |
| MCP/n8n restrictions | implemented/documented | setup/end-to-end evidence required for beta |
| Runtime token handling | hardened (secondary token model) | rotation rehearsal evidence required for production |
| Log redaction | implemented (CI: 20/20 passes) | candidate log-redaction artifact required |
| Secret scanning | implemented (CI: passes) | no current blocker |
| Rate limits | memory/Redis/edge topology supported | multi-instance evidence required for production |
| Fraud controls | implemented and integration-tested | production carrier-level proof required |
| Sensitive data storage (SIP) | AES-256-GCM at rest | provider/media storage decision documented but not evidenced |
| Recording/voicemail/CDR retention | DB + API + worker exist | object-storage cleanup/export-before-delete gap |
| Legal hold | implemented (DB + API) | DSR/right-to-erasure interaction evidence required |
| Export controls | implemented | export-before-delete not complete for production |

---

## Runtime evidence audit

| Gate | Status | Evidence state |
|---|---|---|
| Local runtime gate | scripted (`local-runtime-release-gate.sh`) | not run in this audit (no FreeSWITCH runtime) |
| Self-hosted FreeSWITCH smoke workflow | configured (`freeswitch-smoke.yml`) | latest verified: run 26803056139 on feature branch; candidate-bound run required |
| Production runtime E2E | scripted (`production-runtime-e2e.mjs`) | candidate artifact required; not run |
| SIP REGISTER smoke | scripted (`sip-register-smoke.mjs`) | candidate artifact required |
| SIP TLS/SRTP/NAT smoke | scripted + historical JSON | historical artifact exists; candidate artifact required |
| FreeSWITCH hardening | scripted (CI: passes check-config) | target deployment artifact required |
| Restore evidence | scripted + historical rehearsal | current RC artifact required; not run this session |
| Soak evidence | scripted + historical lab evidence | current RC artifact required; not run this session |
| Runtime SLO evidence | scripted + historical lab evidence | current RC artifact required; not run this session |
| Carrier interop | live evidence present (FusionPBX/NetGSM) | manifest reference required; lab-only; live carrier re-test required before production carrier traffic |
| Release evidence bundle | scripted (`release-evidence-check.mjs`) | check-config passes; v0.2.0 manifest has placeholders |

---

## Deployment/hardening audit

Production deployment documentation covers:
- Reverse proxy assumptions and runtime endpoint isolation
- PostgreSQL exposure and encryption
- FreeSWITCH hardening (hardening check CI: passes)
- Network hardening (4 NAT/RTP/SRTP warnings in dev; expected)
- TLS/SRTP/NAT guidance
- Backup/restore/upgrade playbooks
- Rate limiting (4 production-limit warnings in dev; expected)
- Secrets management
- Monitoring hooks

All docs are accurate deployment guidance. **None are validated in the target release environment.** Target-environment validation is required before production promotion.

Notable finding: `production:preflight` fails on 10 items in this environment (missing required production env vars). This is expected in a development environment but means no production deployment has been validated for the current codebase in this session.

---

## Backup/restore/retention audit

- Backup and restore runbooks exist and are documented.
- Historical restore evidence from PR #116 is referenced.
- `restore:rehearsal` script exists and is wired to write evidence JSON; RC
  evidence must be validated with `pnpm restore:evidence-check -- --require-rc`.
- Production promotion requires a current release-candidate restore rehearsal ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â not yet executed.
- Upgrade/migration playbook exists as a template; real rehearsal not yet evidenced.
- Retention/legal hold: DB schema, API endpoints, and purge worker all exist.
- Production gap: object-storage cleanup, export-before-delete behavior, and DSR/right-to-erasure interaction are not yet evidenced. `docs/ops/recording-voicemail-cdr-retention.md` accurately states this gap.

---

## SDK/MCP/n8n audit

| Surface | Status | Remaining evidence |
|---|---|---|
| SDK | Generated package, TypeScript client, publish workflow exist | Dry-run/publish evidence for the candidate; latest workflow run failed |
| MCP | 16 safe tools, drift tests pass (CI), capability matrix documented | Setup proof and capability-matrix check for the candidate |
| n8n | 10 workflow templates, setup guide, signature verification documented | End-to-end workflow import/run proof against the candidate API |

---

## Release blockers

### Public Alpha ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Closed

| Gate | Issue | Status |
|---|---|---|
| Clean-clone verification and release notes evidence | [#130](https://github.com/gokbilge/manageCallAI/issues/130) | evidenced for `v0.2.0-alpha` |

### Public Beta ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Blocking

| Gate | Issue | Status | Next action |
|---|---|---|---|
| Self-hosted FreeSWITCH runtime smoke (candidate-bound) | [#137](https://github.com/gokbilge/manageCallAI/issues/137) | scripted + feature-branch evidence; candidate run required | Run smoke on `release/**` branch |
| Observability HUD beta surface evidence | [#131](https://github.com/gokbilge/manageCallAI/issues/131) | implemented; no candidate UI evidence | Attach screenshot/test from running stack |
| Webhook signing, replay, idempotency evidence | [#132](https://github.com/gokbilge/manageCallAI/issues/132) | implemented; no candidate evidence | Cite CI run and docs |
| n8n example workflows end-to-end | [#133](https://github.com/gokbilge/manageCallAI/issues/133) | documented; no run proof | Import and run against candidate API |
| MCP setup and capability matrix proof | [#134](https://github.com/gokbilge/manageCallAI/issues/134) | documented/tested; no candidate setup proof | Attach tool-list/call proof |
| SDK publish/dry-run evidence | [#135](https://github.com/gokbilge/manageCallAI/issues/135) | scripted; latest workflow run failed | Rerun SDK dry-run/publish workflow |
| Coverage thresholds (API ÃƒÂ¢Ã¢â‚¬Â°Ã‚Â¥70%, Web/MCP/Go ÃƒÂ¢Ã¢â‚¬Â°Ã‚Â¥70%) | [#141](https://github.com/gokbilge/manageCallAI/issues/141) | documented exception; no candidate report | Attach coverage report for candidate |
| Candidate evidence bundle | [#150](https://github.com/gokbilge/manageCallAI/issues/150) | open | Assemble and validate manifest |

### Production Release ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Blocking

| Gate | Issue | Status | Required evidence | Next action |
|---|---|---|---|---|
| Production runtime E2E and RC smoke | [#137](https://github.com/gokbilge/manageCallAI/issues/137) | scripted; no RC manifest entry | RC-bound smoke run URL + uploaded runtime artifacts | Run on `rc/**` or `release/**` |
| Restore rehearsal (RC environment) | [#160](https://github.com/gokbilge/manageCallAI/issues/160) | evidenced historically; RC evidence required | Restore rehearsal JSON for RC topology validated with `--require-rc` | Rerun `pnpm restore:rehearsal -- --require-rc` |
| Upgrade/migration rehearsal | [#140](https://github.com/gokbilge/manageCallAI/issues/140) | documented template; not yet executed | Upgrade + rollback rehearsal record | Execute rehearsal |
| SIP TLS/SRTP/NAT evidence (RC) | [#92](https://github.com/gokbilge/manageCallAI/issues/92) | historical artifact exists; RC required | Validated SIP TLS/SRTP/NAT JSON for RC topology | Rerun for RC |
| Runtime token/secret rotation evidence | [#94](https://github.com/gokbilge/manageCallAI/issues/94) | scripted/historical; RC evidence required | Rotation rehearsal JSON + log redaction linkage | Rerun for RC |
| Log redaction evidence artifact | ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â | CI passes (20/20); no candidate artifact | Redaction evidence JSON from candidate logs | Generate artifact |
| Production soak/load evidence (RC topology) | [#100](https://github.com/gokbilge/manageCallAI/issues/100) | lab evidence exists; RC evidence required | Soak evidence from target topology | Run `pnpm production:soak` |
| Runtime SLO evidence (RC topology) | [#100](https://github.com/gokbilge/manageCallAI/issues/100) | lab evidence exists; RC evidence required | Runtime lookup latency evidence | Run `pnpm production:slo-check` |
| Carrier interop certification | [#138](https://github.com/gokbilge/manageCallAI/issues/138) | Live FusionPBX/NetGSM lab evidence; manifest placeholder | Carrier evidence referenced from RC manifest; live carrier re-test | Validate and link in manifest |
| Backup retention policy (target env) | [#99](https://github.com/gokbilge/manageCallAI/issues/99) | documented; target-env evidence required | Target backup-retention policy validation | Run `pnpm check:backup-retention-policy` |
| Retention/legal hold (storage + DSR) | [#136](https://github.com/gokbilge/manageCallAI/issues/136) | API + worker exist; storage cleanup missing | API tests + object-storage cleanup + DSR handling | Close gap or accept documented risk |
| Firewall/network hardening (target env) | [#93](https://github.com/gokbilge/manageCallAI/issues/93) | documented + scripted; target-env evidence required | Network config + hardening evidence for target | Validate target deployment |
| Outbound toll-fraud controls (carrier-level) | fraud slice | Implemented; no carrier-level evidence | Fraud allow/block proof with audit/alert evidence | Run live policy proof |
| Multi-instance rate limiting evidence | ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â | Scripted (4 warnings); topology not validated | Target deployment rate-limit validation | Validate multi-instance or confirm edge enforcement |
| Release evidence bundle + operator signoff | [#103](https://github.com/gokbilge/manageCallAI/issues/103) | v0.1 manifest validated; v0.2 manifest has placeholders | Passing `release:evidence-check` manifest + operator signoff | Complete manifest and obtain signoff |
| Current candidate evidence tracking | [#150](https://github.com/gokbilge/manageCallAI/issues/150) | open | v0.2 manifest tied to candidate commit | Run gates and update manifest |

---

## PBX Completeness Audit

Audit date: 2026-06-03.

| Capability | Current status | Release impact | Required design docs | Required implementation | Required evidence |
|---|---|---|---|---|---|
| Feature codes | Designed, not implemented | P1 production | docs/pbx/feature-codes.md | feature_codes table, service, controller, Lua executor, runtime callback, UI | DTMF smoke on self-hosted runner |
| Call parking | Designed, not implemented | P1 production | docs/pbx/call-parking.md | parking_lots + parked_calls tables, service, controller, Go agent event listener, UI | valet_park smoke with Go agent event ingestion |
| Native conferencing | Designed, not implemented | P1 production | docs/pbx/conferencing.md | conference_rooms table, service, controller, mod_xml_curl projection, UI | mod_conference two-caller smoke |
| Gateway reload on trunk change | Designed, not implemented | P0 production | docs/pbx/gateway-reload-on-trunk-change.md | runtime_apply_requests/results tables, service with allowlist, Go agent RuntimeApplyClient, UI | trunk change ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ REGED confirmation on self-hosted runner |
| End-user self-service portal | Designed, not implemented | P2 production | docs/pbx/end-user-self-service.md | end_user role, self_service_policies table, /me/* endpoints, portal UI | integration test matrix |
| FreeSWITCH runtime management (read-only) | Designed, not implemented | P1 production | docs/pbx/freeswitch-runtime-management.md | Go agent /status endpoint, platform/nodes/:id/* endpoints, UI | Node status visible in platform dashboard |
| FreeSWITCH runtime management (actions) | Designed, not implemented | P1/P2 production | docs/pbx/freeswitch-runtime-management.md | runtime_operations table, allowlist enforcement, approval gate, Go agent execute-operation | reloadxml/rescan action smoke |

**Summary:** The PBX Completeness Layer is **designed and planned** as of 2026-06-03.
No features are implemented, tested, or evidenced. None of these capabilities
should be counted in the current release stage.

---

## CHANGELOG consistency finding

This audit found a duplicate `[Unreleased]` section in `CHANGELOG.md` containing
entries already present in the `[0.2.0-alpha]` section. The duplicate was removed
as part of this audit. The footer links were also updated to reference `v0.2.0-alpha`
as the latest tag with the correct comparison URL.

---

## GitHub issues

All blocker issues referenced above already exist in the tracker (#92ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“#103,
#130ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“#141, #150). No new issues were created in this audit. Issue bodies should
use the template in `docs/planning/open-release-blockers.md`.

Recommended labels: `release-blocker`, `beta`, `production`, `security`,
`runtime`, `freeswitch`, `sip`, `srtp`, `nat`, `ci`, `evidence`, `docs`,
`testing`, `backup-restore`, `observability`, `frontend`, `rate-limit`,
`fraud`, `retention`, `sdk`, `mcp`, `n8n`, `ops`.

---

## Evidence required before next stage

### Before public beta ready

- Passing candidate-bound FreeSWITCH smoke run tied to `release/**` or `rc/**` branch.
- Candidate CI/coverage report (requires PostgreSQL environment).
- SDK package dry-run or publish success.
- MCP setup and capability matrix proof against candidate API.
- n8n workflow import/run proof.
- Webhook signing/replay/idempotency proof with candidate CI citation.
- Operator UI evidence for IVR, approvals, rollback, and observability HUD.
- Assembled and validated `release-evidence-v0.2.0.json` manifest.

### Before production ready

All public beta evidence, plus:

- Complete release evidence manifest tied to RC commit.
- Runtime E2E, restore/upgrade, soak/load, SLO, carrier, rate-limit (multi-instance),
  rotation, log-redaction, hardening, and backup-retention artifacts.
- Retention storage/export/DSR decisions implemented or explicitly accepted with
  owner, risk, mitigation, and rollback plan.
- Operator signoff.

---

manageCallAI is not production-ready unless all production evidence gates pass with real artifacts tied to the release candidate commit.
