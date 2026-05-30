# Architecture Boundary Checklist

Use this checklist before merging changes that affect API behavior, runtime
integration, MCP tools, n8n workflows, contracts, database schema, or publishable
objects.

## Ownership

- Business rules live in API service classes.
- SQL repositories contain persistence logic, not lifecycle policy.
- PostgreSQL stores canonical desired state, lifecycle state, audit records, and
  normalized runtime observations.
- FreeSWITCH consumes active published state and produces runtime events.
- The Go agent coordinates FreeSWITCH runtime integration; it does not own tenant
  policy or publish decisions.
- Lua executes constrained per-call actions and reports results.

## State Classification

Classify every new field, table, endpoint, event, or payload as one of:

- desired state: operator intent stored before runtime activation
- lifecycle state: draft, validated, simulated, pending approval, published,
  superseded, rolled back
- runtime state: observed live facts from FreeSWITCH or adapters
- runtime-generated artifact: XML, action payload, token, prompt media URL, or
  projection derived from published state
- business-level event: tenant-scoped event emitted from domain behavior
- audit record: actor, action, target, decision, and metadata for accountability

Do not mix these categories in one unbounded payload.

## API And Contracts

- Public REST uses business vocabulary, not raw FreeSWITCH or provider vocabulary.
- Request and response schemas are defined in `packages/contracts`.
- Generated OpenAPI is regenerated after contract changes.
- SDK and MCP checks are updated when public contracts change.
- Runtime-internal endpoints are clearly documented and require runtime-scoped
  authentication.

## AI, MCP, And n8n

- MCP tools are narrower than REST.
- n8n examples use business events and approved API operations.
- No AI/workflow surface exposes raw ESL, raw XML editing, shell execution,
  arbitrary SQL, or direct runtime commands.
- Mutating AI/workflow paths support validation and dry-run or simulation before
  publish where applicable.
- Audit actor identity distinguishes human, API key, workflow, and MCP/AI actors.

## Runtime Boundary

- FreeSWITCH remains stock.
- Runtime artifacts are derived from published desired state.
- Lua does not contain tenant policy, graph traversal, validation, publish,
  rollback, AI orchestration, or workflow delivery.
- Go agent does not become the source of truth for configuration.
- Runtime callbacks cannot mutate draft or published state except through explicit
  API-owned lifecycle operations.

## Publish And Rollback

- Publishable objects have immutable versions or equivalent version history.
- Validation is required before publish.
- Simulation is available for behavior that affects call routing or IVR traversal.
- Publish records the active version and actor.
- Rollback records the target version, actor, reason, and resulting active state.
- Runtime projection reads the active published version only.

## Security And Observability

- Tenant isolation is enforced on every mutation and read.
- Secrets are write-only in public APIs.
- Runtime tokens are not accepted in query strings.
- Business events exclude raw provider payloads, raw FreeSWITCH payloads, SIP
  passwords, and unbounded media URLs.
- Changes that affect runtime behavior have tests or an explicit audit note.
