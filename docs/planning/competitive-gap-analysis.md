# Competitive Gap Analysis

Last updated: 2026-06-04.

This document evaluates `manageCallAI` against the requirements for becoming a
hard competitor to mature PBX products such as FusionPBX, FreePBX, 3CX, and
VitalPBX.

The purpose is to classify what the current repository actually supports, what
is partial, what is missing, and why each gap matters commercially.

Status vocabulary:

- `implemented` — present in code and product surface enough to count as real
- `partial` — present in code but weak, incomplete, or not fully productized
- `scripted but not surfaced` — runtime/script support exists, but operators do
  not get a strong first-class product workflow
- `documented only` — design/docs exist, but code or product surface does not
  support it yet
- `missing` — no meaningful implementation found in the current code line

## Executive summary

`manageCallAI` is strongest where older PBX panels are weakest:

- desired-state control plane
- validate/simulate/publish/rollback lifecycle
- tenant isolation and capability gating
- runtime evidence and release-gate discipline
- safe API boundaries for AI, MCP, and workflow automation

`manageCallAI` is weakest where mature PBX buyers expect complete operational
coverage out of the box:

- classic PBX completeness beyond the current IVR/routing core
- gateway/trunk operator workflows in the web UI
- end-user product surface
- carrier/MSP tooling
- buyer-visible AI features

The product is already credible as a modern FreeSWITCH control plane. It is not
yet a hard competitor to mature PBX suites because several table-stakes and
operator-facing product surfaces are still partial.

## Release train mapping

The next competitive roadmap is mapped to the next three planned product
releases:

- `v0.4.x` = `P0`
- `v0.5.x` = `P1`
- `v0.6.x` = `P2`

This mapping is intentionally product-first:

- `v0.4.x` closes the most visible table-stakes and operator workflow gaps
- `v0.5.x` deepens operational maturity and end-user completeness
- `v0.6.x` delivers the clearest AI-native differentiators

## PBX completeness audit

| Capability | Status | Priority | Why it matters | Current gap / why not enough |
|---|---|---:|---|---|
| Extensions / devices / registrations | implemented | P0 | Core PBX function | Admin and runtime foundations exist; end-user device UX remains weak |
| SIP trunks / gateways | implemented | P0 | Carrier connectivity | CRUD exists, but operator-grade apply/test workflow is still partial |
| Inbound routes / outbound routes | implemented | P0 | Call routing foundation | Strong backend model; needs broader runtime diff/apply evidence in UI |
| IVR builder | implemented | P0 | Business routing requirement | Strongest differentiator already |
| Ring groups / call groups | implemented | P0 | Office PBX basic | Needs broader operator usage evidence |
| Queues / agents | implemented | P0/P1 | Contact-center entry point | Basic queue model exists; not a full contact-center surface |
| Voicemail boxes | implemented | P0 | Expected PBX feature | Retention, storage, and end-user workflow still need stronger productization |
| Voicemail-to-email | partial | P1 | Common admin expectation | Voicemail exists; email workflow is not a clear first-class product feature |
| Feature codes | implemented | P1 | Phone-user workflow | Full admin surface shipped: list/create/validate/publish/disable/delete with emergency-number collision detection |
| Call forwarding / DND | partial | P1 | End-user self-service | API exists; end-user product surface is still thin |
| Call pickup | partial | P1 | Office workflow | Feature-code action exists in contracts/design, but operator/end-user surface is weak |
| Call parking | implemented | P1 | Common PBX feature | Admin UI shipped: parking-lot CRUD, parked-call sub-panel (slot/status/timeout), runtime empty/error states |
| Conferencing / `mod_conference` | implemented | P1 | Expected business feature | Admin UI shipped: conference room CRUD with PIN, participant limit, recording toggle, and live participant panel |
| Call recording | partial | P1 | Compliance and support | Recordings surface exists; storage/export/retention proof is still a gap |
| CDR / call history / reporting | partial | P1 | Admin visibility | Calls/events exist, but reporting depth is below mature PBX competitors |
| Music on hold | partial | P1 | Basic PBX polish | Queue-level `music_on_hold` exists, but there is no complete admin experience |
| Time conditions / holidays | partial | P1 | Production routing | Schedules exist; holiday/business-hours polish needs product review |
| Emergency number handling | implemented | P0 | Safety and legal | Non-bypassable block at fraud service + outbound-call service + shared constants; feature-code collision detection; posture documented in docs/ops/emergency-routing.md |
| E911 / emergency routing docs | implemented | P0 | Legal and safety requirement | Full deployment guide, US market E911 boundaries, FCC Kari's Law/RAY BAUM's Act posture, and testing procedures in docs/ops/emergency-routing.md |
| Backup / restore | partial | P0 | Operations requirement | Strong evidence model exists; buyer confidence depends on current-tag rehearsal evidence |

## Control-plane lifecycle audit

| Object type | Status | Why it matters | Current gap |
|---|---|---|---|
| IVR flows | implemented | This is the flagship control-plane workflow | Already strong |
| Inbound routes | implemented | Live call behavior changes should be controlled | Good backend posture; UI/runtime evidence can improve |
| Outbound routes | implemented | Routing and fraud changes affect live traffic | Same as inbound routes |
| SIP trunks | partial | Trunk changes are high-risk live operations | Apply requests exist, but full diff/approval/runtime UX is not complete |
| Feature codes | implemented | Live phone behavior needs the same safety model | Validate/publish/disable cycle with web admin surface and emergency-number collision detection |
| Parking lots | implemented | Operational PBX object | CRUD/runtime with web admin surface; parked-call visibility and slot presentation |
| Conference rooms | implemented | Live call bridge object | CRUD/runtime with web admin surface; participant visibility and room lifecycle controls |
| Fraud policies | partial | High operational and financial risk | Strong backend posture; limited product UX and evidence presentation |

## Runtime operations audit

| Capability | Status | Priority | Why it matters | Current gap |
|---|---|---:|---|---|
| Node registration and status snapshots | implemented | P0 | Required for safe operations | Read-only strength |
| Gateway apply request lifecycle | implemented | P0 | Required for safe trunk changes | Present in API; not strongly surfaced in UI |
| Affected-node fan-out | partial | P0 | Needed when one change touches multiple nodes | Current implementation is narrower than full operator expectation |
| Active-call safety checks | partial | P0 | Prevent disruptive reloads | Design intent exists; user-facing safety flow is incomplete |
| Gateway/profile diff before apply | documented only | P0 | Operators need change visibility | No strong first-class product diff flow found |
| Approval before risky runtime actions | partial | P0/P1 | Live-call safety | Approval model exists generally; runtime-action UX is incomplete |
| Post-apply verification (`REGED`/UP) | partial | P0 | Confirms runtime accepted the change | Status/evidence exist, but workflow is not operator-polished |
| Rollback after runtime apply | partial | P1 | Live telecom recovery | Rollback philosophy exists; runtime-action rollback flow is not mature |
| Controlled runtime actions (`reloadxml`, rescan) | partial | P1 | Needed for safe operations | Status APIs exist; action-trigger UX remains incomplete |

## Operator UI audit

| Surface | Status | Priority | Why it matters | Current gap |
|---|---|---:|---|---|
| Role-aware navigation | implemented | P0 | Basic product trust | Already good |
| Tenant/platform workspace split | implemented | P0 | Separation of concerns | Already good |
| Visual IVR builder | implemented | P0 | Main differentiator | Strong |
| IVR validation/simulation/publish/rollback | implemented | P0 | Safe live-change workflow | Strong |
| Approvals page | implemented | P1 | Controlled release workflow | Needs broader cross-object usage |
| Live operations cockpit | partial | P0 | Operators judge trust here | Good foundation, not yet best-in-class |
| Runtime sessions / call visibility | implemented | P1 | Troubleshooting | Good, but still narrower than a mature NOC/operator view |
| FreeSWITCH node health | partial | P1 | Runtime trust | Platform endpoints exist; tenant/admin UI depth is limited |
| Gateway registration status | implemented | P0 | Carrier troubleshooting | Gateway state table in SIP trunks page + trunk test workflow; REGED/DOWN/TRYING/FAILED per node |
| Feature-code management UI | implemented | P1 | Admin usability | Full admin surface: list, create, validate, publish, disable, delete with emergency-number safeguard |
| Parking-lot management UI | implemented | P1 | Admin usability | Full admin surface: CRUD, parked-call sub-panel with slot/status/timeout, auto-refresh |
| Conference-room management UI | implemented | P1 | Admin usability | Full admin surface: CRUD with PIN/participants/recording controls and live participant panel |
| Apply history / gateway reload UI | implemented | P0 | Runtime operations differentiator | Apply request history visible in SIP trunks page expanded row (status, error, active calls, timestamps) |
| Evidence bundle status in operator UI | partial | P1 | Differentiator and release trust | Evidence model exists mostly in docs/scripts |
| Carrier test wizard UI | implemented | P0/P1 | Telecom installer trust | Trunk test workflow page: run connectivity test, per-outcome failure guidance, live gateway table, session history |

## Integrations audit

| Capability | Status | Priority | Why it matters | Current gap |
|---|---|---:|---|---|
| Webhooks | implemented | P0 | External automation | Good |
| REST API | implemented | P0 | Programmability | Good |
| SDK generation | implemented | P1 | Developer experience | Needs stronger release/publish maturity per release posture |
| MCP | implemented | P1 | Safe AI programmability | Strong architecture, needs setup/product adoption proof |
| n8n patterns | partial | P1 | Workflow automation | Present as patterns/examples more than turnkey product feature |
| Slack / Teams notifications | partial | P1/P2 | Operational workflow | Can be built via webhooks, not packaged as product feature |
| CRM integrations | missing | P1/P2 | Market expectation | No packaged integrations found |
| S3/GCS/object storage for recordings | partial | P1 | Media operations | Storage direction exists; buyer-facing setup story needs more maturity |
| Prometheus / Grafana | partial | P1 | Ops observability | Strong docs/direction, less productized operator experience |
| Sentry / OpenTelemetry | partial | P1 | Modern ops tooling | Not a clear first-class feature set yet |
| LDAP / SAML / OIDC SSO | missing | P1 | Enterprise requirement | Not present in current product line |

## Enterprise and security audit

| Capability | Status | Priority | Why it matters | Current gap |
|---|---|---:|---|---|
| Multi-tenant isolation | implemented | P0 | Serious customer requirement | Strong |
| RBAC / capability model | implemented | P0 | Serious customer requirement | Strong |
| Platform vs tenant admin separation | implemented | P0 | Safe multi-tenant ops | Strong |
| End-user role | implemented | P1 | Product completeness | Surface still thin |
| Audit log | implemented | P0 | Change accountability | Strong |
| Approval policies | implemented | P1 | Safe change control | Needs broader object coverage in UI |
| Rollback model | implemented | P0/P1 | Safe change control | Strongest on IVR |
| Secret rotation / runtime token rotation | implemented | P1 | Security operations | Needs ongoing release-bound evidence |
| SIP credential encryption | implemented | P0 | Sensitive data protection | Strong |
| Rate limiting | implemented | P1 | Abuse prevention | Multi-instance topology proof remains environment-dependent |
| TLS / SRTP / NAT / firewall hardening docs | implemented | P1 | Secure deployment | Needs repeated target-environment proof |
| Backup / restore / rehearsal model | partial | P0 | Operations requirement | Must stay tied to release-bound evidence |
| Retention / legal hold | partial | P1 | Compliance requirement | Product model exists; enforcement/export flows need more confidence |
| Export controls | partial | P1 | Compliance and portability | Export-before-delete still an area to watch |
| Operator signoff and evidence bundles | implemented | P1 | Release discipline | Strong engineering practice; limited operator-facing UX |

## AI-value audit

| Capability | Status | Priority | Why it matters | Current gap |
|---|---|---:|---|---|
| AI-safe architecture | implemented | P0 | Prevents unsafe AI operations | Strong |
| MCP business abstractions | implemented | P1 | AI integration surface | Strong |
| Natural-language IVR generation | partial | P1 | Clear buyer-visible AI value | Not yet a polished flagship feature |
| IVR linting / risk detection | partial | P1 | Real operator value | Validation exists; AI-assisted interpretation is weak |
| Call failure explanation | missing | P1 | High operational value | Strong candidate differentiator not yet delivered |
| Route risk analysis | missing | P1 | High operational value | Needed for safe change explanation |
| Voicemail / call summaries | partial | P1/P2 | Obvious AI productivity feature | Analysis contract exists; productized workflow is limited |
| Fraud anomaly detection | missing | P1/P2 | High operator value | Fraud policy exists, anomaly intelligence does not |
| Natural-language reporting | missing | P2 | Differentiator | Not present |

## End-user and mobile audit

| Capability | Status | Priority | Why it matters | Current gap |
|---|---|---:|---|---|
| End-user self-service API | implemented | P1 | Completes PBX story | Present |
| End-user DND / forwarding | partial | P1 | Common phone-user need | API exists; UI is not yet a full end-user portal |
| End-user voicemail access | partial | P1 | Common phone-user need | Policy and data model exist; polished product flow is unclear |
| End-user call history | partial | P1 | Common phone-user need | Data exists; end-user surface is weak |
| Device / registration self-view | partial | P1 | Useful operational self-service | Design/docs exist; product surface is limited |
| SIP password reset | missing | P1 | Common admin/end-user workflow | Not found as a clear product feature |
| QR provisioning | missing | P2 | Modern softphone onboarding | Not present |
| Mobile-friendly UX / PWA | partial | P2 | Completeness and adoption | General web app exists; not positioned as an end-user mobile product |
| WebRTC / native softphone | missing | P2 | Full cloud-PBX competition | Out of current scope |

## Carrier / MSP tooling audit

| Capability | Status | Priority | Why it matters | Current gap |
|---|---|---:|---|---|
| SIP REGISTER smoke | scripted but not surfaced | P1 | Basic interop confidence | Good for evidence; not a strong operator UI workflow |
| SIP TLS / SRTP / NAT smoke | scripted but not surfaced | P1 | Secure carrier readiness | Good evidence tooling; weak operator-facing workflow |
| Directory smoke test | implemented | P1 | Useful operator check | Present in tenant UI |
| Carrier interop evidence | partial | P1 | Production confidence | Strong release gate, limited day-to-day operator UX |
| Carrier profile templates | missing | P1 | Installer productivity | Not found |
| Trunk test wizard | missing | P0/P1 | Strong competitive surface | Not present |
| DTMF / codec / NAT test UI | missing | P1 | Installer productivity | Not present |
| Failover trunk groups | missing | P1 | Real telecom requirement | Not found as product feature |
| Least-cost routing | missing | P2 | Carrier/MSP competitiveness | Not found |
| Prefix fraud limits | partial | P1 | Telecom abuse prevention | Policy model exists; UX depth can improve |
| Carrier health dashboard | partial | P1 | Installer/operator trust | Status endpoints exist; dashboard maturity is limited |

## What is needed first, and why

### P0

1. Gateway/trunk apply workflow in the web UI
   - Why: this is the strongest path to beating older PBX GUIs on safe ops.
2. Feature-code, parking, and conference admin surfaces
   - Why: the backend exists; without UI, buyers still perceive these as missing.
3. Emergency routing and safety guidance
   - Why: necessary for trust, especially in US-facing deployments.
4. Trunk/carrier test workflow
   - Why: installers and operators expect this immediately.
5. Stronger CDR/reporting and live ops cockpit
   - Why: operators trust what they can inspect quickly.

Release target: `v0.4.x`

### P1

1. End-user portal completion
2. Evidence bundle status surfaced in the product UI
3. Better retention/storage/export operational flows
4. Carrier health and template workflows
5. Approval/runtime safety applied consistently across more object types

Release target: `v0.5.x`

### P2

1. AI call failure explanation
2. AI route risk analysis
3. AI voicemail/call summaries
4. Natural-language reporting

Release target: `v0.6.x`

## Bottom line

`manageCallAI` should compete as a safe, programmable, AI-native FreeSWITCH
control plane.

It already has the architecture and safety model to support that position.

It does not yet have enough complete PBX surface area and operator workflow
polish to be a hard competitor to the mature PBX products it will be compared
against first.
