# Release Buckets `v0.4` - `v0.6`

Last updated: 2026-06-05 (`v0.5.x` status corrected; `v0.6.x` queue prepared).

This document turns the competitive gap audit into concrete issue buckets for
the next three planned product releases:

- `v0.4.x` = `P0` competitive baseline
- `v0.5.x` = `P1` operational maturity
- `v0.6.x` = `P2` AI-native differentiation

These are product-planning buckets, not release evidence claims.

## `v0.4.x` - P0 competitive baseline

Goal: make the product feel like a credible hard PBX competitor for admins and
operators, not just a strong backend/control-plane architecture.

**v0.4.x status as of 2026-06-04: all 7 buckets shipped.**

### Bucket 1: Gateway and trunk operations UI ✅ shipped

Why:
- trunk/runtime apply is one of the strongest differentiators
- the backend lifecycle exists, but the operator workflow is still weak

Closed by:
- SIP trunks page with gateway state, apply request history, and per-node
  registration visibility (issue #202, shipped in v0.3.5)
- SIP trunk gateway operations UI (issue #202, merged)

Expected outcome:
- tenant/platform admins can inspect apply requests, apply results, and gateway
  state without dropping to API-only workflows ✅

### Bucket 2: Feature-code admin surface ✅ shipped

Why:
- feature codes are implemented in API/runtime
- buyers still perceive them as missing without a first-class admin surface

Closed by:
- Feature-code list/create/validate/publish/disable/delete web UI (issue #203,
  merged in v0.3.5 / v0.4 baseline)

Expected outcome:
- tenant admins can manage feature codes entirely from the web app ✅

### Bucket 3: Parking admin surface ✅ shipped

Why:
- parking exists in API/runtime
- product surface does not yet expose it as a real PBX feature

Closed by:
- Parking-lot CRUD with parked-call sub-panel (auto-refresh 10 s), slot range,
  timeout, and runtime empty/error states (issue #204, merged)

Expected outcome:
- call parking becomes visibly usable as a PBX feature, not just an API ✅

### Bucket 4: Conference admin surface ✅ shipped

Why:
- conference-room desired state exists
- no first-class admin page means the feature still reads as incomplete

Closed by:
- Conference room CRUD with PIN, max-participants, record-calls controls and
  live participant panel (issue #205, merged)

Expected outcome:
- conference rooms become manageable from the operator UI ✅

### Bucket 5: Carrier and trunk test workflow ✅ shipped

Why:
- telecom installers and operators expect direct validation workflows
- current evidence tooling is stronger than the current product UI

Closed by:
- Trunk test workflow page at /tenant/integrations/trunk-test-workflow with
  per-outcome failure guidance, live gateway state table, session history, and
  carrier interop checklist (issue #206, merged)

Expected outcome:
- first operator-facing carrier/trunk test workflow exists in product ✅

### Bucket 6: Reporting and cockpit baseline ✅ shipped

Why:
- operators trust what they can inspect quickly
- current calls/events/cockpit surfaces are useful but still thinner than
  mature PBX competitors

Closed by:
- Stronger CDR/call history reporting, cockpit triage improvements, and
  failed-call/runtime-error visibility (issue #207, merged as #216)

Expected outcome:
- the product feels more operationally credible day to day ✅

### Bucket 7: Emergency routing and safety guidance ✅ shipped

Why:
- safety/legal posture matters, especially for US-facing deployments
- current posture is not strong enough to market as a complete PBX product

Closed by:
- Centralized emergency number constants (non-bypassable, auditable single
  source of truth); full emergency routing guide at docs/ops/emergency-routing.md
  covering product posture, operator/carrier responsibilities, E911 boundaries,
  US FCC compliance (Kari's Law, RAY BAUM's Act), pre-go-live smoke tests, and
  explicit posture statement (issue #208, merged)

Expected outcome:
- emergency handling is no longer a vague edge topic in the product story ✅

## `v0.5.x` - P1 operational maturity

Goal: deepen operator trust, end-user completeness, and enterprise operations.

**`v0.5.x` status as of 2026-06-05: all 5 buckets shipped. Production release v0.5.0 published.**

### Bucket 1: End-user portal completion

Why:
- end-user APIs exist
- the product still feels admin-heavy and end-user-light

Suggested issues:
- `v0.5: end-user voicemail and call history surface`
- `v0.5: end-user devices/registrations surface`
- `v0.5: end-user DND/forwarding UX completion`
- `v0.5: SIP password reset / self-service account tasks`

Expected outcome:
- the product feels more complete as a PBX, not only as an admin console

### Bucket 2: Evidence visibility in the product

Why:
- runtime evidence is a real differentiator
- it should be visible to operators, not only to engineers reading manifests

Suggested issues:
- `v0.5: evidence bundle status panel`
- `v0.5: release/runtime gate visibility in operator UI`
- `v0.5: audit/evidence correlation for live-impacting changes`

Expected outcome:
- evidence-first operations becomes a visible product capability

### Bucket 3: Retention, storage, and export maturity

Why:
- compliance posture is already a strength
- the operational flows still need clearer product completion

Suggested issues:
- `v0.5: recording/voicemail retention operator workflows`
- `v0.5: export-before-delete operator workflow`
- `v0.5: media storage lifecycle visibility`

Expected outcome:
- retention/export is not only policy and backend logic, but a usable operator flow

### Bucket 4: Carrier health and templates

Why:
- installers and MSPs need repeatable trunk onboarding and status workflows

Suggested issues:
- `v0.5: carrier profile templates`
- `v0.5: carrier health dashboard`
- `v0.5: carrier onboarding/operator checklist`

Expected outcome:
- carrier operations are faster and more repeatable

### Bucket 5: Broader lifecycle consistency

Why:
- the safety lifecycle is strongest on IVR
- the product should feel consistent across more high-risk objects

Suggested issues:
- `v0.5: approval/runtime safety parity across PBX objects`
- `v0.5: publish/rollback consistency beyond IVR`
- `v0.5: object-level risk presentation improvements`

Expected outcome:
- manageCallAI feels more like one coherent safe control plane

Current dependency:
- issue #228 remains open and should close before `v0.6.x` implementation starts in earnest

## `v0.6.x` - P2 AI-native differentiation

Goal: deliver buyer-visible AI features that reduce operator work and explain
risk clearly.

Entry condition:
- complete the remaining `v0.5.x` lifecycle-consistency work in issue #228 so
  AI explanations and risk views can rely on broader publish-lifecycle parity
  across PBX objects

Design constraints:
- AI is assistive, not autonomous
- outputs must be grounded in normalized API-owned records
- any proposed change remains a draft until normal lifecycle checks approve it
- natural-language queries compile to bounded report filters, not raw SQL or shell

Planned queue:
- umbrella issue: `#232` `v0.6 AI-native differentiation release queue`
- bucket issue: `#233` `v0.6: AI call failure explanation`
- bucket issue: `#234` `v0.6: AI route and change risk analysis`
- bucket issue: `#235` `v0.6: AI voicemail/call summaries and operator review`
- bucket issue: `#236` `v0.6: natural-language telecom reporting`

### Bucket 1: AI incident and failure explanation

Why:
- this is one of the clearest operator-value AI features

Suggested issues:
- `v0.6: AI call failure explanation`
- `v0.6: AI runtime/log explanation for operators`

Expected outcome:
- operators can understand failures faster without decoding raw telecom signals

### Bucket 2: AI route and change risk analysis

Why:
- safe change explanation is core to the product thesis

Suggested issues:
- `v0.6: AI route risk analysis`
- `v0.6: AI change-impact summary for live telecom objects`

Expected outcome:
- risky changes become easier to understand before publish

### Bucket 3: AI summaries

Why:
- summaries are a visible, expected AI value area

Suggested issues:
- `v0.6: voicemail summaries`
- `v0.6: call/recording summaries`
- `v0.6: operator review summary workflows`

Expected outcome:
- AI saves time in common operator review workflows

### Bucket 4: Natural-language reporting

Why:
- reporting is useful today, but not yet differentiated

Suggested issues:
- `v0.6: natural-language call reporting`
- `v0.6: natural-language failure and route queries`

Expected outcome:
- reporting becomes more accessible and differentiated

## Suggested label scheme

Base labels:

- `release-0.4`
- `release-0.5`
- `release-0.6`
- `frontend`
- `api`
- `runtime`
- `freeswitch`
- `pbx`
- `observability`
- `security`
- `docs`
- `ai`
- `carrier`
- `reporting`

Priority mapping:

- `release-0.4` = `P0`
- `release-0.5` = `P1`
- `release-0.6` = `P2`

## Recommended opening order

Open first for `v0.4.x`:

1. gateway and trunk operations UI
2. feature-code admin surface
3. parking admin surface
4. conference admin surface
5. carrier and trunk test workflow
6. reporting and cockpit baseline
7. emergency routing and safety guidance

Open first for `v0.5.x` only after `v0.4.x` scope is staffed.

Open first for `v0.6.x` only after `v0.5.x` scope is materially underway.

Start implementation for `v0.6.x` only after issue #228 is closed or explicitly
split so AI risk/explanation work has a stable lifecycle baseline.
