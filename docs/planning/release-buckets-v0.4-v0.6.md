# Release Buckets `v0.4` - `v0.6`

Last updated: 2026-06-04.

This document turns the competitive gap audit into concrete issue buckets for
the next three planned product releases:

- `v0.4.x` = `P0` competitive baseline
- `v0.5.x` = `P1` operational maturity
- `v0.6.x` = `P2` AI-native differentiation

These are product-planning buckets, not release evidence claims.

## `v0.4.x` - P0 competitive baseline

Goal: make the product feel like a credible hard PBX competitor for admins and
operators, not just a strong backend/control-plane architecture.

### Bucket 1: Gateway and trunk operations UI

Why:
- trunk/runtime apply is one of the strongest differentiators
- the backend lifecycle exists, but the operator workflow is still weak

Suggested issues:
- `v0.4: trunk apply history and status UI`
- `v0.4: gateway reload/rescan operator workflow`
- `v0.4: post-apply verification and failure visibility`
- `v0.4: active-call safety checks and risky-action warnings`

Expected outcome:
- tenant/platform admins can inspect apply requests, apply results, and gateway
  state without dropping to API-only workflows

### Bucket 2: Feature-code admin surface

Why:
- feature codes are implemented in API/runtime
- buyers still perceive them as missing without a first-class admin surface

Suggested issues:
- `v0.4: feature-code list/create/edit UI`
- `v0.4: feature-code validate/publish/disable flow`
- `v0.4: feature-code conflict and emergency-number warnings`

Expected outcome:
- tenant admins can manage feature codes entirely from the web app

### Bucket 3: Parking admin surface

Why:
- parking exists in API/runtime
- product surface does not yet expose it as a real PBX feature

Suggested issues:
- `v0.4: parking-lot CRUD UI`
- `v0.4: parked-call visibility UI`
- `v0.4: parking slot/operator state presentation`

Expected outcome:
- call parking becomes visibly usable as a PBX feature, not just an API

### Bucket 4: Conference admin surface

Why:
- conference-room desired state exists
- no first-class admin page means the feature still reads as incomplete

Suggested issues:
- `v0.4: conference-room CRUD UI`
- `v0.4: conference participant visibility UI`
- `v0.4: conference validation and operator status surface`

Expected outcome:
- conference rooms become manageable from the operator UI

### Bucket 5: Carrier and trunk test workflow

Why:
- telecom installers and operators expect direct validation workflows
- current evidence tooling is stronger than the current product UI

Suggested issues:
- `v0.4: trunk register test UI`
- `v0.4: directory/dialplan/runtime smoke workflow UI`
- `v0.4: carrier test result history and failure explanation`

Expected outcome:
- first operator-facing carrier/trunk test workflow exists in product

### Bucket 6: Reporting and cockpit baseline

Why:
- operators trust what they can inspect quickly
- current calls/events/cockpit surfaces are useful but still thinner than
  mature PBX competitors

Suggested issues:
- `v0.4: stronger CDR/call history reporting baseline`
- `v0.4: cockpit improvements for gateway/call/runtime visibility`
- `v0.4: failed-call and runtime-error triage improvements`

Expected outcome:
- the product feels more operationally credible day to day

### Bucket 7: Emergency routing and safety guidance

Why:
- safety/legal posture matters, especially for US-facing deployments
- current posture is not strong enough to market as a complete PBX product

Suggested issues:
- `v0.4: emergency routing safeguards in product and docs`
- `v0.4: E911/emergency deployment guidance by market`

Expected outcome:
- emergency handling is no longer a vague edge topic in the product story

## `v0.5.x` - P1 operational maturity

Goal: deepen operator trust, end-user completeness, and enterprise operations.

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

## `v0.6.x` - P2 AI-native differentiation

Goal: deliver buyer-visible AI features that reduce operator work and explain
risk clearly.

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
