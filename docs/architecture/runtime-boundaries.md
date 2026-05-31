# Runtime Boundaries

`manageCallAI` is a control plane over stock FreeSWITCH. FreeSWITCH is the media
and signaling runtime. The API owns desired state, lifecycle decisions, safety
policy, audit, and observability.

## Boundary Summary

| Component | Owns | Must not own |
|-----------|------|--------------|
| API | Desired state, validation, simulation, publish, rollback, authorization, audit, contracts, normalized runtime views. | Raw media handling, SIP stack behavior, raw ESL console semantics. |
| PostgreSQL | Canonical desired state, versions, lifecycle records, audit records, normalized runtime observations. | Unvalidated switch blobs as source of truth, hand-edited active runtime state. |
| Go FreeSWITCH agent | ESL connectivity, event ingestion, bounded runtime coordination, posting runtime facts to API. | Tenant policy, lifecycle state machine, graph traversal, direct database writes. |
| Lua | Per-call execution of constrained actions, collecting DTMF or call-session results, reporting outcomes. | Business logic, tenant policy, publish/rollback, validation, AI/workflow orchestration. |
| FreeSWITCH | SIP signaling, media, call execution, event emission, module runtime. | Project-specific control-plane logic, canonical configuration storage, AI/tool access. |
| MCP | AI-safe business tools for read, draft, validate, simulate, and request publish. | REST parity, raw ESL/XML/shell control, runtime-internal endpoints. |
| n8n/webhooks | Business-event reactions and approved API workflows. | Runtime command channel, raw provider or FreeSWITCH control. |

## API Responsibilities

The API is the only component that decides whether desired state is valid,
simulated, published, rolled back, authorized, or auditable.

The API may generate runtime artifacts, including FreeSWITCH XML projections and
constrained IVR action payloads. Those artifacts are outputs of active published
state, not user-authored source of truth.

## Go Agent Responsibilities

The Go agent sits outside FreeSWITCH and speaks to it through supported runtime
interfaces such as ESL. It may:

- maintain FreeSWITCH runtime connectivity
- ingest events and CDR-like data
- call runtime-internal API endpoints with runtime credentials
- coordinate bounded runtime operations requested by the API

It must not:

- persist desired state directly
- decide tenant authorization or lifecycle policy
- execute arbitrary user, MCP, or workflow commands
- expose raw ESL as an external control API

## Lua Responsibilities

Lua runs inside the switch and must stay small. It may:

- play prompts
- collect DTMF or call-session input
- transfer, hang up, or set constrained variables when instructed
- call the API or agent for the next constrained runtime action
- report action outcomes

Lua must not:

- traverse IVR graphs independently
- evaluate tenant policy
- publish or roll back versions
- store business state
- call AI providers or workflow systems directly

## FreeSWITCH Responsibilities

FreeSWITCH remains stock. It handles SIP, media, modules, dialplan execution, and
runtime event generation. It consumes configuration and action artifacts generated
from published desired state.

Manual FreeSWITCH edits can be useful for emergency operations, but they are
runtime drift from the platform perspective. Durable configuration changes must
return through the API lifecycle.

## Runtime-Internal Endpoints

Runtime-internal endpoints are for FreeSWITCH, Lua, or the Go agent. They must:

- require runtime-scoped authentication
- be documented as runtime-internal in OpenAPI
- return constrained artifacts or accept normalized runtime observations
- avoid broad business mutations
- log actor identity and tenant context where applicable

They must not become hidden admin APIs.

## Runtime-Generated Artifacts

Runtime-generated artifacts include:

- FreeSWITCH directory XML
- FreeSWITCH dialplan XML projections
- IVR runtime action payloads
- temporary prompt or recording access URLs
- runtime tokens or correlation identifiers

These artifacts are derived outputs. They are not canonical desired state and
should be regenerated from PostgreSQL whenever possible.
