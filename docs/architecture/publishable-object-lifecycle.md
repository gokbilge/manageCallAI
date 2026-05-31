# Publishable Object Lifecycle

Publishable objects are telecom business objects whose changes can affect live
runtime behavior. Examples include IVR flows and inbound routes. Future
publishable objects should use the same vocabulary unless an ADR explicitly
defines a different lifecycle.

## Terms

Desired state is the intended configuration stored in PostgreSQL before or after
activation. It includes drafts, immutable versions, validation results,
simulation results, publish records, and rollback history.

Runtime state is observed live behavior from FreeSWITCH, adapters, workers, or
providers. It includes sessions, registrations, call events, queue pressure,
runtime health, and delivery outcomes. Runtime state can inform operators, but it
is not the canonical source of configuration intent.

Draft state is proposed desired state that is not active.

Validated state means the API has checked structure, references, tenant scope,
policy, and known runtime constraints. Validation does not activate runtime
behavior.

Simulated state means the API has produced a deterministic preview or trace for a
scenario. Simulation does not activate runtime behavior.

Published state is the active desired-state version selected for runtime
projection and consumption.

Rollback is a lifecycle operation that activates a previous eligible published
version and records the actor, reason, source version, and target version.

Business-level events are tenant-scoped events emitted from domain behavior, such
as `ivr_flow.published`, `ivr_flow.rollback_completed`, or
`outbound_call.failed`. They are not raw FreeSWITCH or provider payload dumps.

Runtime-generated artifacts are derived outputs such as FreeSWITCH XML,
constrained IVR action payloads, temporary media access URLs, or correlation
tokens. They are generated from published state and runtime context.

## Lifecycle

```text
draft
  -> validated
  -> simulated
  -> pending approval or policy accepted
  -> published
  -> superseded
  -> rolled back
```

Not every object needs a separate persisted row for every label, but every object
that can affect runtime behavior must preserve the semantics.

## Draft

Draft operations create or update desired state without affecting runtime. Drafts
may be created by humans, API clients, MCP tools, or workflow automations, but
all paths enter through the API.

Drafts must not be consumed by FreeSWITCH.

## Validation

Validation checks at least:

- schema shape
- required references
- tenant ownership
- lifecycle preconditions
- unsafe or unsupported graph/runtime constructs
- policy and approval requirements

Validation failures should be returned as business-level errors with actionable
locations where possible.

## Simulation

Simulation previews behavior without runtime activation. For IVR and routing
objects, simulation should produce a trace or outcome that explains the selected
path and important decisions.

Simulation must not create live calls, edit FreeSWITCH configuration, or mark a
version active.

## Publish

Publish activates one validated version for runtime consumption. The API records:

- actor identity
- object identity
- version identity
- prior active version, if any
- approval or policy decision, if applicable
- timestamp and result

Publish should be atomic from the domain perspective. Runtime components then
derive artifacts from the active published version.

## Rollback

Rollback activates a previous eligible version through the same API-owned
lifecycle boundary. It is not manual database repair.

Rollback records:

- actor identity
- reason
- source active version
- target version
- resulting lifecycle event

Runtime lookups after rollback must resolve to the new active version.

## Contributor Rules

- Add lifecycle logic in API services, not SQL, Go agent, Lua, MCP tools, or n8n
  templates.
- Add or update Zod contracts before exposing lifecycle payloads publicly.
- Regenerate OpenAPI after contract changes.
- Add tests that prove drafts do not affect runtime and publish/rollback does.
- Emit business-level events rather than raw runtime payloads.
- Keep runtime-generated artifacts derivable from published desired state.
