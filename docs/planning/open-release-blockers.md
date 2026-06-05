# Open Release Blockers

Last updated: 2026-06-05.

Authoritative issue state lives in GitHub. This file records release gates and
evidence requirements so closed issues are not mistaken for production evidence.

Scripts, templates, docs, check-config mode, and issue closure are **not** evidence.
Evidence must be a real artifact (workflow run URL, uploaded JSON, CI run) tied
to the release-candidate commit.

## Current Release Stage

```
Latest evidenced production tag: v0.5.0 (cut 2026-06-05 from main at 6df5fab)
RC tag:                          v0.5.0-rc.1 (commit 6df5fab, smoke run 26993419772)
Production evidence:             docs/release/release-evidence-v0.5.0.json
RC evidence:                     docs/release/release-evidence-v0.5.0-rc.1.json
Next:                            v0.6.x AI-native differentiation (issues #232–#236)
```

## What closed for v0.3.0 (2026-06-03)

| Issue | Gate | Resolution |
|---|---|---|
| [#161](https://github.com/gokbilge/manageCallAI/issues/161) | Retention storage cleanup + DSR | StorageBackend file deletion, DSR doc, export-before-delete decision ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â PR #181 |
| [#162](https://github.com/gokbilge/manageCallAI/issues/162) | Soak/SLO/carrier interop | RC-topology SLO evidence, FusionPBX/NetGSM 6/8 passed, PBX evidence in manifest ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â PR #182 |
| [#163](https://github.com/gokbilge/manageCallAI/issues/163) | Token rotation, log redaction, hardening | rotation-rehearsal.mjs, network config JSON output, log redaction CI gate ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â PR #183 |
| [#164](https://github.com/gokbilge/manageCallAI/issues/164) | Final release bundle + operator signoff | Live rotation rehearsal, rate-limit proof, production manifest v0.3.0 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â PRs #185, #186 |
| [#171](https://github.com/gokbilge/manageCallAI/issues/171) | PBX Completeness Layer (parent) | All 6 features implemented ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â PRs #179, #180 |
| [#172](https://github.com/gokbilge/manageCallAI/issues/172) | Feature codes | Implemented ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â PR #179 |
| [#173](https://github.com/gokbilge/manageCallAI/issues/173) | Call parking | Implemented ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â PR #179 |
| [#174](https://github.com/gokbilge/manageCallAI/issues/174) | Conferencing | Implemented ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â PR #179 |
| [#175](https://github.com/gokbilge/manageCallAI/issues/175) | Gateway reload | Implemented ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â PR #179 |
| [#176](https://github.com/gokbilge/manageCallAI/issues/176) | End-user self-service portal | Implemented ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â PR #180 |
| [#177](https://github.com/gokbilge/manageCallAI/issues/177) | FreeSWITCH runtime management (Phase 1) | Implemented ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â PR #180 |
| [#178](https://github.com/gokbilge/manageCallAI/issues/178) | PBX evidence gates | Implemented ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â PR #180 |

## What closed previously (alpha ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ beta)

| Issue | Gate | Resolution |
|---|---|---|
| [#130](https://github.com/gokbilge/manageCallAI/issues/130) | Clean-clone alpha verification | Evidenced for v0.2.0-alpha |
| [#131ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“#141](https://github.com/gokbilge/manageCallAI/issues/131) | Beta-readiness gates | All closed for v0.2.0-beta.1 |
| [#150](https://github.com/gokbilge/manageCallAI/issues/150) | Beta evidence bundle | v0.2.0-beta.1 manifest passes validator |
| [#157](https://github.com/gokbilge/manageCallAI/issues/157) | n8n workflows E2E | CLOSED ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â beta-smoke-26845537361 |
| [#158](https://github.com/gokbilge/manageCallAI/issues/158) | MCP capability proof | CLOSED ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â beta-smoke-26845537361 |
| [#159](https://github.com/gokbilge/manageCallAI/issues/159) | SDK dry-run | CLOSED ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â run 26845539137 |
| [#160](https://github.com/gokbilge/manageCallAI/issues/160) | Restore rehearsal | CLOSED ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â restore-evidence-enlogy-2026-06-02.json |

## Production Release ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â All Gates Closed

All production gates closed for v0.3.0.

| Gate | Issue | Evidence |
|---|---|---|
| FreeSWITCH smoke on `rc/**` | [#164](https://github.com/gokbilge/manageCallAI/issues/164) | Run [26903877370](https://github.com/gokbilge/manageCallAI/actions/runs/26903877370) on `rc/v0.3.0` |
| Production E2E | [#164](https://github.com/gokbilge/manageCallAI/issues/164) | All 11 steps verified, smoke run 26903877370 |
| SLO | [#162](https://github.com/gokbilge/manageCallAI/issues/162) | `docs/ops/runtime-slo-evidence-2026-06-03.json` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â directory p99 15 ms, dialplan p99 22 ms |
| Carrier interop | [#162](https://github.com/gokbilge/manageCallAI/issues/162) | `docs/ops/carrier-interop-evidence-fusionpbx-2026-06-02.json` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 6/8 passed |
| Rotation rehearsal | [#163](https://github.com/gokbilge/manageCallAI/issues/163) | `docs/ops/rotation-rehearsal-2026-06-03.json` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â live, passed |
| Log redaction | [#163](https://github.com/gokbilge/manageCallAI/issues/163) | `docs/ops/log-redaction-rotation-2026-06-03.json` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 0 findings |
| Network config | [#163](https://github.com/gokbilge/manageCallAI/issues/163) | `docs/ops/network-config-rc-v0.3.0.json` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 0 findings in smoke context |
| Rate-limit topology | [#163](https://github.com/gokbilge/manageCallAI/issues/163) | Single-instance proof on enlogy@10.0.0.32 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 0 findings |
| Retention storage cleanup | [#161](https://github.com/gokbilge/manageCallAI/issues/161) | PR #181 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â StorageBackend + DSR doc |
| PBX completeness | [#171ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“#178](https://github.com/gokbilge/manageCallAI/issues/171) | PRs #179, #180 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â all 6 features |
| Release evidence bundle | [#164](https://github.com/gokbilge/manageCallAI/issues/164) | `docs/release/release-evidence-v0.3.0.json` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â `release:evidence-check` exits 0 |
| Operator signoff | [#164](https://github.com/gokbilge/manageCallAI/issues/164) | Fatih Kucukpetek, maintainer, 2026-06-03 |

## Open Issues for Next Release

No open release blockers. New issues will be tracked in GitHub.

## PBX Completeness Layer ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Implemented in v0.3.0

All six PBX completeness features were implemented in PRs #179 and #180 (issues
#172ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“#178, parent #171) and are closed as of v0.3.0. Design docs live in
`docs/pbx/`. Phase 2 controlled runtime actions (reloadxml/rescan via UI with
approval gate) remain deferred for a future release.

Historical issue creation templates are preserved below for reference.

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
- Runtime smoke: DTMF code ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Lua ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ API callback ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ action applied

## Runtime evidence required

Live FreeSWITCH smoke: DTMF code dialed ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Lua executor ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ API callback ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ audit event.

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
- Runtime smoke: call parked on FreeSWITCH ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Go agent ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ API record updated

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
- Dialplan: room number ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ conference application
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
- Go agent: RuntimeApplyClient ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â safe ESL command sequence
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
- Runtime smoke: trunk change ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ gateway reloads on FreeSWITCH ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ REGED confirmed

## Runtime evidence required

Self-hosted FreeSWITCH smoke run: trunk updated ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ apply request ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ ESL commands
sent ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ REGED state confirmed ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ audit events written.

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

- /me/* endpoints use JWT sub as implicit scope ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no user ID override
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
- Action types are an explicit enum ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no user string reaches ESL
- Module reload allowlist: mod_conference, mod_valet_parking, mod_xml_curl, mod_sofia only

## Testing

- Allowlist enforcement, approval gate, tenant isolation
- Runtime smoke: reloadxml triggered via UI ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Go agent ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ result recorded

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
- Gateway reload: trunk change ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ REGED confirmation smoke
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
