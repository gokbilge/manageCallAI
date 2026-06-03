# Open Release Blockers

Last updated: 2026-06-02.

Authoritative issue state lives in GitHub. This file records release gates and
evidence requirements so closed issues are not mistaken for production evidence.

Scripts, templates, docs, check-config mode, and issue closure are **not** evidence.
Evidence must be a real artifact (workflow run URL, uploaded JSON, CI run) tied
to the release-candidate commit.

## Current Release Stage

```
Decision:         Public beta candidate
Tag:              v0.2.0-beta.1 (cut 2026-06-02 from main at b51cdd5)
Evidence status:  Beta evidence manifest passes pnpm release:evidence-check
                  Smoke run 26825030902 passed all gates on self-hosted runner
Next step:        n8n / MCP / SDK end-to-end evidence before beta-ready promotion
                  Full production evidence bundle before RC promotion
```

## What closed since the last update (2026-06-02)

| Issue | Gate | Resolution |
|---|---|---|
| [#130](https://github.com/gokbilge/manageCallAI/issues/130) | Clean-clone alpha verification | Evidenced for v0.2.0-alpha |
| [#131](https://github.com/gokbilge/manageCallAI/issues/131) | Observability HUD | Implemented — candidate run evidence still required for beta-ready |
| [#132](https://github.com/gokbilge/manageCallAI/issues/132) | Webhook signing/replay/idempotency | Implemented and CI-tested |
| [#133](https://github.com/gokbilge/manageCallAI/issues/133) | n8n workflows | Documented — end-to-end run proof still required |
| [#134](https://github.com/gokbilge/manageCallAI/issues/134) | MCP setup and capability matrix | Documented and drift-tested — run proof still required |
| [#135](https://github.com/gokbilge/manageCallAI/issues/135) | SDK publish/dry-run | Workflow exists — latest run failed; re-run required |
| [#136](https://github.com/gokbilge/manageCallAI/issues/136) | Retention and legal hold API | API and worker implemented — storage cleanup gap remains |
| [#137](https://github.com/gokbilge/manageCallAI/issues/137) | Self-hosted FreeSWITCH smoke | Smoke run 26825030902 passed all gates |
| [#138](https://github.com/gokbilge/manageCallAI/issues/138) | Carrier interop | Lab evidence (FusionPBX/NetGSM) in manifest — live carrier scenarios pending |
| [#139](https://github.com/gokbilge/manageCallAI/issues/139) | Rate-limit production values | Documented; multi-instance topology not yet validated |
| [#140](https://github.com/gokbilge/manageCallAI/issues/140) | Upgrade/migration rehearsal | Template documented — rehearsal not yet executed |
| [#141](https://github.com/gokbilge/manageCallAI/issues/141) | Coverage thresholds | API 67.46% / Web 80% / MCP 85% — thresholds raised |
| [#150](https://github.com/gokbilge/manageCallAI/issues/150) | Candidate evidence bundle | v0.2.0-beta.1 manifest passes validator |

## Public Alpha — Closed

All alpha gates are closed for `v0.2.0-alpha`.

## Public Beta — Open Blockers

The `v0.2.0-beta.1` tag exists and the evidence manifest passes `pnpm release:evidence-check`.
These gates remain open before the project can be described as **beta-ready**:

| Gate | Issue | P | Status | Required evidence | Next action |
|---|---|---|---|---|---|
| n8n example workflows end-to-end | [#157](https://github.com/gokbilge/manageCallAI/issues/157) | P0 | **CLOSED** — 9/9 templates valid; HMAC-SHA256 signing compatible with n8n; live webhook delivery queued. Evidence: beta-smoke-26845537361 | — | Closed |
| MCP setup and capability matrix proof | [#158](https://github.com/gokbilge/manageCallAI/issues/158) | P0 | **CLOSED** — 22/22 tools listed via MCP protocol; live list_ivr_flows call succeeded. Evidence: beta-smoke-26845537361 | — | Closed |
| SDK publish/dry-run | [#159](https://github.com/gokbilge/manageCallAI/issues/159) | P0 | **CLOSED** — Build+pack dry-run passed (run 26845539137); workflow fixed to not fail on tag pushes | — | Closed |
| Operator UI evidence | — | P0 | IVR builder, approvals, rollback, HUD implemented — no run-stack screenshot/test | Screenshot or test evidence from a running stack | Run stack, capture screenshots for release notes |
| Observability HUD from running stack | — | P0 | Implemented — smoke passed but no isolated UI proof | Evidence from running stack (screenshot or test) | Covered by operator UI evidence above |

## Production Release — Open Blockers

None of the following gates are evidenced for a production release candidate.
All require real artifacts from the target deployment environment.

| Gate | Issue | P | Status | Required evidence | Next action |
|---|---|---|---|---|---|
| Production runtime E2E on `rc/**` branch | [#164](https://github.com/gokbilge/manageCallAI/issues/164) | P0 | Smoke run 26825030902 on `docs/beta-evidence-v0.2.0` branch — must be re-run on `rc/**` | `FreeSWITCH runtime smoke` check on `release/**` or `rc/**` | Create rc branch; smoke triggers automatically |
| Restore rehearsal (RC environment) | [#160](https://github.com/gokbilge/manageCallAI/issues/160) | P1 | Template documented; historical evidence from PR #116 | `pnpm restore:rehearsal` JSON for RC environment | Execute rehearsal |
| Upgrade and migration rehearsal | [#160](https://github.com/gokbilge/manageCallAI/issues/160) | P1 | Template at `docs/ops/upgrade-rehearsal-evidence.md`; not yet executed | Upgrade + rollback rehearsal record | Execute rehearsal |
| SIP TLS/SRTP/NAT evidence (RC topology) | [#163](https://github.com/gokbilge/manageCallAI/issues/163) | P1 | Historical artifact from smoke run 26803056139; RC-topology artifact required | Validated SIP TLS/SRTP/NAT JSON from RC environment | Rerun on RC topology |
| Runtime token and secret rotation evidence | [#163](https://github.com/gokbilge/manageCallAI/issues/163) | P1 | Check passes; no rehearsal artifact for RC | Rotation rehearsal JSON + log redaction linkage | `pnpm check:runtime-token-rotation -- --evidence=<file>` |
| Log redaction artifact (candidate) | [#163](https://github.com/gokbilge/manageCallAI/issues/163) | P1 | CI passes (20/20); no candidate-level artifact file | Sanitized log artifact from candidate deployment | Generate and attach artifact |
| Production soak / load evidence (RC topology) | [#162](https://github.com/gokbilge/manageCallAI/issues/162) | P1 | Lab evidence from PR #116 (1800s, 0% failure, p95 8.78ms); RC topology evidence required | `pnpm production:soak` output from target environment | Run soak on target env |
| Runtime SLO evidence (RC topology) | [#162](https://github.com/gokbilge/manageCallAI/issues/162) | P1 | Lab evidence: directory p95 12.8ms, dialplan p95 17.19ms; RC evidence required | `pnpm production:slo-check` against target env | Run SLO check |
| Carrier interop certification — live carrier | [#162](https://github.com/gokbilge/manageCallAI/issues/162) | P1 | Lab: sip_register, TLS, NAT passed; inbound/outbound/DTMF/hangup require live carrier | Re-test all 8 scenarios with real carrier trunk | Schedule live carrier test |
| Backup retention policy (target env) | [#160](https://github.com/gokbilge/manageCallAI/issues/160) | P1 | Template documented; no target-env validation | `pnpm check:backup-retention-policy` against target | Run validator with target policy |
| Retention storage / object cleanup | [#161](https://github.com/gokbilge/manageCallAI/issues/161) | P1 | DB + API + worker exist; object-storage file deletion and export-before-delete NOT implemented | Implementation + evidence | See issue #161 |
| DSR / right-to-erasure behavior | [#161](https://github.com/gokbilge/manageCallAI/issues/161) | P1 | Not documented | Documentation + implementation decision | See issue #161 |
| Firewall / network hardening (target env) | [#163](https://github.com/gokbilge/manageCallAI/issues/163) | P1 | Docs + check pass in dev (4 warnings); target-env evidence required | `pnpm check:network-config` against production config | Validate target deployment |
| Outbound toll-fraud controls (carrier level) | [#162](https://github.com/gokbilge/manageCallAI/issues/162) | P1 | Policy API + integration tests implemented; no carrier-level block/allow proof | Fraud allow/block proof with audit + alert evidence | Run live policy proof |
| Multi-instance rate limiting | [#163](https://github.com/gokbilge/manageCallAI/issues/163) | P1 | Redis store implemented; 4 warnings in check — no topology proof | Production topology validation | `pnpm production:rate-limit-check` with production config |
| Release evidence bundle + operator signoff | [#164](https://github.com/gokbilge/manageCallAI/issues/164) | P0 | v0.2.0-beta.1 manifest passes validator with beta fields; production fields still TBD | Completed manifest for RC commit + operator signoff | Assemble once all P1s close |

## PBX Completeness Layer — Planned Issues

These issues describe the PBX Completeness Layer features. They are **not current
release blockers** for public beta. They are planned for production PBX
completeness. Create them in GitHub when implementation work begins.

The copy below is ready to paste into GitHub issue creation.

---

### Epic: PBX Completeness Layer

**Title:** PBX Completeness Layer: feature codes, parking, conferencing, runtime apply, self-service, module management

**Labels:** `pbx`, `architecture`, `beta`, `production`, `runtime`, `freeswitch`, `docs`

**Body:**

```markdown
## Why

manageCallAI covers IVR flows, routing, extensions, trunks, queues, and voicemail.
To be usable as the primary control plane for a FreeSWITCH PBX deployment,
additional primitives are required: feature codes, call parking, conferencing,
safe gateway reload, end-user self-service, and runtime visibility.

## Current state

All six features are designed in `docs/pbx/`. None are implemented.

## Scope

See docs/pbx/PBX_COMPLETENESS_LAYER.md for the full feature list.

Child issues: #<feature-codes> #<call-parking> #<conferencing> #<gateway-reload> #<self-service> #<runtime-mgmt>

## Non-goals

Raw ESL passthrough, arbitrary XML editing, softphone, billing, device firmware.

## Architecture

All features follow the same safety model: API owns desired state, FreeSWITCH
is runtime-only, Go agent handles ESL, Lua is a thin executor, MCP/n8n stay
narrower than REST, all live-impacting actions are audited, tenant isolation is absolute.

## Release impact

P0: gateway reload on trunk change (production)
P1: feature codes, call parking, conferencing, runtime visibility (production)
P2: end-user self-service, controlled runtime actions (production)
```

---

### Issue 1: Feature codes

**Title:** Design and implement tenant-scoped feature codes

**Labels:** `pbx`, `production`, `freeswitch`, `runtime`

**Body:**

```markdown
## Why

Tenant admins cannot currently define DTMF feature codes (voicemail access,
DND, call forward, parking, conference join) without editing FreeSWITCH XML directly.

## Current state

Designed in docs/pbx/feature-codes.md. Not implemented.

## Scope

- feature_codes table (migration 0050)
- Feature code service: collision detection, emergency number check
- Feature code controller: CRUD + validate + publish
- Lua thin executor: feature_code_handler.lua
- Runtime callback endpoint: POST /api/v1/runtime/feature-code/execute
- OpenAPI contracts in packages/contracts
- UI: list, create/edit, conflict detection, dialplan preview, publish

## Non-goals

Raw ESL passthrough. Custom Lua scripts via API.

## API/Data model

See docs/pbx/feature-codes.md and docs/pbx/pbx-data-model-and-api-proposal.md.

## Security

- code UNIQUE per tenant_id
- Emergency number collision check before save and publish
- Runtime callback: HMAC node auth only
- Cross-tenant isolation tested

## Testing

- Unit: duplicate code prevention, emergency number block
- Integration: tenant isolation matrix, lifecycle, audit events
- Runtime smoke: DTMF code → Lua → API callback → action applied

## Runtime evidence required

Live FreeSWITCH smoke: DTMF code dialed → Lua executor → API callback → audit event.

## Acceptance criteria

- feature_codes CRUD with collision detection
- Validate and publish lifecycle
- Dialplan served via mod_xml_curl
- Lua thin executor calls back to API
- Audit events for all mutations and runtime executions
- Tenant isolation: Tenant A cannot access Tenant B codes

## Release impact

P1 for production PBX completeness.
```

---

### Issue 2: Call parking

**Title:** Design and implement call parking

**Labels:** `pbx`, `production`, `freeswitch`, `runtime`

**Body:**

```markdown
## Why

Operators cannot currently park calls and retrieve them via slot codes.
FreeSWITCH supports valet_park natively; manageCallAI needs a desired-state
model around it.

## Current state

Designed in docs/pbx/call-parking.md. Not implemented.

## Scope

- parking_lots + parked_calls tables (migration 0051)
- Parking service: slot assignment, tenant isolation
- Parking controller: CRUD lots + parked call read
- Go agent: CHANNEL_PARK / CHANNEL_UNPARK event listener
- Runtime callbacks: park / retrieve / timeout
- UI: parking lot config, live slot occupancy panel in Observability HUD

## Non-goals

Manual park via API (runtime-only via FreeSWITCH).

## Testing

- Tenant isolation, slot collision, timeout behavior, audit events
- Runtime smoke: call parked on FreeSWITCH → Go agent → API record updated

## Runtime evidence required

Live FreeSWITCH valet_park smoke run with Go agent event ingestion.

## Acceptance criteria

- Parking lot CRUD
- parked_calls record created/updated by Go agent callbacks
- Timeout routing applied when slot expires
- Audit events for all park/retrieve/timeout events

## Release impact

P1 for production. Not a public beta gate.
```

---

### Issue 3: Native conferencing

**Title:** Design and implement native conferencing with mod_conference

**Labels:** `pbx`, `production`, `freeswitch`, `runtime`

**Body:**

```markdown
## Why

Tenants need conference rooms for multi-party calls. FreeSWITCH mod_conference
is the runtime engine; manageCallAI needs a desired-state model and UI.

## Current state

Designed in docs/pbx/conferencing.md. Not implemented.

## Scope

- conference_rooms + conference_participant_snapshots tables (migration 0052)
- Conference service: PIN hashing, room uniqueness, profile generation
- Conference controller: CRUD
- mod_xml_curl: conference.conf.xml projection
- Dialplan: room number → conference application
- Go agent: conference join/leave event listener (optional)
- UI: room list, create/edit with masked PIN, participant view

## Security

- PINs bcrypt-hashed, never returned in responses
- Conference profile names include tenant_id to prevent cross-tenant collision

## Testing

- PIN hashing, room uniqueness, tenant isolation, recording policy
- Runtime smoke: two callers join conference room

## Runtime evidence required

Live FreeSWITCH mod_conference smoke: two callers connected, PIN enforced.

## Acceptance criteria

- Conference room CRUD
- mod_xml_curl serves conference profile and dialplan
- PIN validation via FreeSWITCH conference app
- Audit events for CRUD

## Release impact

P1 for production PBX completeness.
```

---

### Issue 4: Gateway reload on trunk change

**Title:** Implement safe gateway reload/apply on SIP trunk change

**Labels:** `pbx`, `production`, `freeswitch`, `runtime`, `p0`

**Body:**

```markdown
## Why

Currently, trunk CRUD stores desired state but does not notify FreeSWITCH to
reload the affected gateway. Operators must run manual CLI commands. This is
the highest-priority gap in the PBX completeness layer.

## Current state

Designed in docs/pbx/gateway-reload-on-trunk-change.md. Not implemented.
Trunk CRUD exists. mod_xml_curl gateway serving exists. No apply mechanism.

## Scope

- runtime_apply_requests + runtime_apply_results tables (migration 0053)
- RuntimeApplyService: allowlist enforcement, active call count gate
- RuntimeApplyController: apply request CRUD + apply-now trigger
- Go agent: RuntimeApplyClient — safe ESL command sequence
- Trunk PATCH response: runtime_apply field
- UI: trunk change summary, generated gateway preview, apply status
- Approval gate integration

## Allowlisted safe actions only

reloadxml, sofia_profile_rescan, sofia_profile_killgw, sofia_profile_restartgw,
sofia_status_gateway, sofia_status_profile

## Security

- Action type enforced as enum in API and Go agent
- Action params validated against registered node/profile/gateway values
- No user input reaches ESL as a raw string

## Testing

- Allowlist enforcement, active call count gate, approval gate
- Tenant isolation, apply lifecycle, Go agent callback
- Runtime smoke: trunk change → gateway reloads on FreeSWITCH → REGED confirmed

## Runtime evidence required

Self-hosted FreeSWITCH smoke run: trunk updated → apply request → ESL commands
sent → REGED state confirmed → audit events written.

## Acceptance criteria

- Trunk PATCH triggers RuntimeApplyRequest
- Go agent executes safe ESL command sequence
- Gateway reaches REGED state
- Failure recorded and shown in UI with rollback guidance
- Audit events for all apply lifecycle transitions

## Release impact

P0 for production. P1 for public beta if trunk operations are in beta scope.
```

---

### Issue 5: End-user self-service portal

**Title:** Design end-user self-service portal

**Labels:** `pbx`, `production`

**Body:**

```markdown
## Why

End users (employees) currently have no way to manage their own voicemail, DND,
or call forwarding without asking IT. A self-service portal reduces helpdesk
load and gives users control over their own settings.

## Current state

Designed in docs/pbx/end-user-self-service.md. Not implemented.

## Scope

- end_user role in users.role check constraint
- end_user_self_service_policies table (migration 0054)
- Extension self-service columns: dnd_enabled, call_forward_enabled, etc.
- /api/v1/me/* endpoints
- /api/v1/tenant/self-service-policy endpoints
- Portal UI: simplified layout separate from admin panel
- Capability gating via tenant policy

## Security

- /me/* endpoints use JWT sub as implicit scope — no user ID override
- All queries join through users.tenant_id
- PIN change requires current PIN
- SIP credential reset returns new credential once only

## Testing

- Role gating, self-ownership enforcement, policy gating
- Cross-tenant isolation
- Sensitive data redaction (PIN hash never returned)

## Acceptance criteria

- end_user role enforced
- /me/* endpoints scoped to authenticated user
- Tenant admin can enable/disable each self-service capability
- Audit events for DND, forward, PIN, credential changes

## Release impact

P2 for production. Not a public beta gate.
```

---

### Issue 6: Safe FreeSWITCH runtime management

**Title:** Design safe FreeSWITCH runtime/module management

**Labels:** `pbx`, `production`, `freeswitch`, `runtime`

**Body:**

```markdown
## Why

Platform operators have no visibility into FreeSWITCH module state or active
call counts without SSH access. A safe read-only status layer and a controlled
action allowlist reduces operational risk.

## Current state

Designed in docs/pbx/freeswitch-runtime-management.md. Not implemented.

## Scope

Phase 1 (read-only):
- Go agent /status endpoint
- platform/nodes/:id/status, /modules, /gateways, /channels, /registrations
- Required module checklist + missing module alert

Phase 2 (controlled actions):
- runtime_operations + runtime_operation_policy tables (migration 0055)
- RuntimeOperationService: allowlist enforcement, approval gate
- RuntimeOperationController: create/list/cancel
- Go agent: execute-operation endpoint

## Security

- Read-only status: platform_admin only
- Controlled actions: platform_admin + approval required
- Action types are an explicit enum — no user string reaches ESL
- Module reload allowlist: mod_conference, mod_valet_parking, mod_xml_curl, mod_sofia only

## Testing

- Allowlist enforcement, approval gate, tenant isolation
- Runtime smoke: reloadxml triggered via UI → Go agent → result recorded

## Acceptance criteria

Phase 1: Node status, module checklist, gateway status visible in platform UI
Phase 2: reloadxml and sofia_profile_rescan triggerable with approval gate

## Release impact

Read-only P1. Controlled actions P1/P2. Arbitrary management: out of scope.
```

---

### Issue 7: PBX completeness release evidence gates

**Title:** Add PBX completeness release evidence gates

**Labels:** `pbx`, `production`, `evidence`, `runtime`, `freeswitch`

**Body:**

```markdown
## Why

Each PBX completeness feature requires runtime smoke evidence before production
promotion. Evidence gates should be added to the release checklist and evidence
manifest once features are implemented.

## Current state

Not implemented. No evidence gates exist for PBX completeness features.

## Scope

For each implemented PBX feature:
- Add runtime smoke evidence requirement to release-checklist.md
- Add evidence field to release-evidence-v0.2.0.json manifest
- Add check to pnpm check:production-readiness

Required evidence per feature:
- Feature codes: DTMF smoke on self-hosted runner
- Call parking: valet_park smoke with Go agent event ingestion
- Conferencing: mod_conference two-caller smoke
- Gateway reload: trunk change → REGED confirmation smoke
- Self-service: integration test matrix (no FreeSWITCH runtime needed)
- Runtime management: reloadxml/rescan action smoke

## Acceptance criteria

- pnpm release:evidence-check validates PBX evidence fields in manifest
- Self-hosted FreeSWITCH smoke workflow covers at least gateway reload

## Release impact

P1 for production promotion once features are implemented.
```

## Issue Body Template

```markdown
## Why

## Current State

## Scope

## Acceptance Criteria

## Evidence Required

## Suggested Files

## Blocked By

## Release Impact
```

Recommended labels: `release-blocker`, `beta`, `production`, `security`,
`runtime`, `freeswitch`, `sip`, `srtp`, `nat`, `ci`, `evidence`, `docs`,
`testing`, `backup-restore`, `observability`, `frontend`, `rate-limit`,
`fraud`, `retention`, `sdk`, `mcp`, `n8n`, `ops`.

Priority guidance:
- P0: blocks public beta or a release gate
- P1: required before production
- P2: hardening or improvement
- P3: docs or cleanup
