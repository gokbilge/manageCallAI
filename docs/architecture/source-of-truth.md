# manageCallAI Project Source of Truth

This document is the canonical product, design, and architecture reference for manageCallAI.

If another document conflicts with this one, this document wins until an explicit architecture decision updates it.

## 0. Current release posture

Current code line: `v0.5.x`. Production release v0.5.0 (2026-06-05) — operational maturity.
Evidence: `docs/release/release-evidence-v0.5.0.json`.

Release stage must be determined from release evidence, not from source inspection alone. When implementation and release claims drift, release claims must defer to:

- `docs/release/product-release-audit.md`
- `docs/release/release-checklist.md`
- `docs/planning/open-release-blockers.md`

Evidence rules:

- Scripts, templates, and docs are not evidence by themselves.
- `--check-config` output is not release evidence.
- Issue closure is not release evidence unless it links to the artifact, workflow run, or release-candidate commit that proves the gate.
- Production evidence must be current for the release candidate being promoted.

## 1. Purpose

manageCallAI is an open-source telecom control plane built on top of stock FreeSWITCH.

Its job is to let humans, workflows, and AI agents manage PBX and IVR behavior through safe, high-level abstractions instead of low-level telecom internals.

manageCallAI does not replace FreeSWITCH. It sits above FreeSWITCH as the management, orchestration, API, workflow, and safety layer.

## 2. Product thesis

Traditional PBX systems expose too much infrastructure detail to operators and automations.

manageCallAI converts telecom administration into safe business actions such as:

- create an extension
- configure a trunk
- assign a DID
- create and publish an IVR flow
- validate and simulate a routing change
- review normalized call events and runtime health
- manage bounded runtime actions through safe APIs instead of raw switch control

## 3. Non-goals

manageCallAI is not:

- a SIP server
- a media server
- a FreeSWITCH replacement
- a raw ESL console
- a low-level dialplan editor exposed to AI agents or workflow systems

## 4. Core product principles

### 4.1 Safety first

No user class, especially AI agents and workflow systems, should be given unrestricted access to FreeSWITCH internals.

### 4.2 Desired state over imperative mutation

The platform models intended telecom configuration as desired state stored in PostgreSQL, then renders that state into FreeSWITCH-facing runtime artifacts.

### 4.3 Validate before publish

Configuration should be validated structurally and behaviorally before becoming active.

### 4.4 Simulation before production

Users should be able to preview route and IVR behavior before publish.

### 4.5 Rollback as a first-class operation

Every publishable object should support version history and safe rollback.

### 4.6 One high-level domain model

UI, REST API, MCP tools, and workflow integrations should all operate on the same domain vocabulary.

### 4.7 Stock FreeSWITCH first

The platform uses stock FreeSWITCH through supported interfaces such as `mod_xml_curl`, ESL, and thin Lua helpers.

## 5. Canonical system model

```text
React Web UI
   -> REST API
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

## 6. Ownership boundaries

### 6.1 API

The API owns:

- desired state
- validation
- simulation
- publish and rollback lifecycle
- authorization and capability gating
- audit and normalized observability
- setup/bootstrap lifecycle
- runtime callback intake and node-scoped runtime auth
- AI policy enforcement for optional provider-backed transcript, summary,
  prompt-generation, and bounded IVR-assist paths

The API must not delegate business lifecycle decisions to Lua, the Go agent, MCP, or n8n.

### 6.2 PostgreSQL

PostgreSQL owns canonical desired state and normalized operational records.

It must not be treated as a place for hand-edited live runtime switch state.

### 6.3 FreeSWITCH

FreeSWITCH executes SIP, media, dialplan, and module runtime behavior.

It must not own project-specific desired state, publish policy, tenant authorization, or AI/tool access.

### 6.4 Lua

Lua remains a thin executor for constrained per-call actions such as prompt playback, DTMF collection, transfer, hangup, and reporting outcomes.

Lua must not contain tenant policy, graph traversal, validation, publish/rollback logic, or AI/workflow orchestration.

### 6.5 Go FreeSWITCH agent

The Go agent owns:

- ESL connectivity
- event ingestion
- bounded runtime coordination
- posting normalized runtime facts back to the API

The Go agent must not own tenant policy, desired state, or direct database writes.

### 6.6 MCP and n8n

MCP and n8n are narrower than REST.

They must not expose:

- raw ESL
- raw XML
- shell access
- SQL access
- direct runtime control bypassing API lifecycle rules

## 7. Implemented capability areas in the current code line

Source inspection shows the repository currently includes:

- auth, tenant/user roles, and capability checks
- extensions, trunks, phone numbers, schedules, inbound and outbound routes
- queues, call groups, voicemail boxes, prompt assets, recordings, and call events
- IVR draft/version lifecycle with validate, simulate, publish, and rollback
- approval-aware IVR publish flows
- FreeSWITCH directory and dialplan callbacks over `mod_xml_curl`
- runtime session handling and Go-agent event intake
- feature codes, parking, conference rooms, runtime apply requests, and end-user self-service
- platform and tenant runtime status visibility
- setup/bootstrap and deployment packaging

## 8. Setup and bootstrap

The API startup path checks `system_config` for the `setup_complete` sentinel.

If setup is incomplete:

- headless bootstrap runs when required `SETUP_*` environment variables are present
- otherwise the API registers `/setup` and related completion routes

After successful completion, the setup surface is removed.

## 9. Contract and SDK authority

`packages/contracts` owns API-facing Zod schemas and OpenAPI component registration.

`docs/api/openapi.yaml` and `packages/sdk/src/generated/schema.ts` are generated artifacts and must stay aligned with the contracts and architecture.

OpenAPI is the canonical machine-readable client artifact. It does not override architecture or domain intent.

## 10. Planned `v0.6.x` AI-native differentiation guardrails

The next planned product release after the `v0.5.x` operational-maturity lane is
`v0.6.x`, focused on buyer-visible AI assistance for operators.

That release is constrained by these rules:

- AI is assistive, not autonomous.
- AI may explain, summarize, classify, and propose drafts.
- AI may not publish, reload, route, or mutate live call behavior outside the
  existing validation, simulation, approval, publish, and rollback lifecycle.
- AI outputs must be tenant-scoped, capability-gated, audited, and replay-safe.
- AI explanations must be grounded in normalized records already owned by the
  API, such as call events, runtime status snapshots, recordings, validation
  results, simulation results, and publish history.
- AI tools must not read raw FreeSWITCH runtime internals directly when the API
  already provides a normalized business-level view.
- Natural-language reporting must compile to bounded domain queries instead of
  ad hoc SQL, shell, or runtime commands.

Planned `v0.6.x` operator outcomes:

- call failure explanation
- route and change risk analysis
- voicemail and call summaries
- natural-language reporting over normalized telecom records

These are product-planning targets, not claims that the current code line
already ships those features.

`v0.6.1` adds the provider-backed AI policy foundation underneath those
workflows:

- platform policy is stored in API-owned configuration, not hidden provider state
- tenant opt-in is explicit and narrower than platform policy
- deterministic fallback remains mandatory when provider-backed execution is
  disabled or rejected by policy
- provider-backed prompt generation and runtime IVR AI requests remain bounded,
  capability-gated, and auditable
- AI-originated IVR drafts persist structured lineage in API-owned metadata and
  always require a human approval record before publish or rollback can affect
  live call behavior
