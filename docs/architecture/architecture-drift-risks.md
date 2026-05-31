# Architecture Drift Risks

This register identifies the drift risks most likely to weaken the
`manageCallAI` architecture. Use it during design review, PR review, slice
planning, and audits.

## Highest-Risk Drift Areas

| Area | Drift risk | Required guardrail |
|------|------------|--------------------|
| API | Business logic moves into SQL, route handlers, generated XML, or runtime callbacks. | Keep orchestration in TypeScript service classes; repositories only persist/query. |
| Web | UI exposes low-level FreeSWITCH primitives as primary workflows. | Present business objects, validation, simulation, publish, rollback, and observability summaries. |
| MCP | AI tools grow toward REST parity or raw runtime control. | MCP stays narrower than REST and uses contract-derived schemas for bounded business actions. |
| n8n/webhooks | Workflows call runtime-internal endpoints or pass arbitrary provider/runtime payloads. | Workflows use business events and approved API operations only. |
| Go agent | Adapter becomes a second control plane with tenant policy, lifecycle, or graph traversal. | Agent ingests events, coordinates ESL, and calls API/runtime endpoints; API owns decisions. |
| Lua | Lua accumulates IVR graph traversal, tenant rules, or AI/workflow orchestration. | Lua executes constrained actions and reports outcomes. |
| Contracts | REST, SDK, MCP, OpenAPI, and examples diverge. | `packages/contracts` Zod schemas drive generated OpenAPI, SDK types, and MCP input checks. |
| DB | PostgreSQL becomes a passive cache for switch state or stores unvalidated runtime blobs as truth. | PostgreSQL stores desired state, active versions, audit, and normalized runtime records. |
| FreeSWITCH | Operators or integrations edit live XML/configuration outside the lifecycle. | Runtime artifacts are derived from published desired state and can be regenerated. |
| Provider adapters | Raw provider payloads or credentials leak into public domain responses. | Store bounded provider-neutral results; keep secrets write-only. |

## Cross-Cutting Failure Modes

- A new endpoint bypasses validation, simulation, approval, audit, or publish.
- A new tool exposes lower-level capability than the equivalent REST workflow.
- A runtime callback accepts a mutation that should be a user/API lifecycle action.
- A generated artifact is edited by hand and becomes inconsistent with contracts.
- A migration adds columns that are not reflected in contracts, docs, or services.
- A business event exposes raw FreeSWITCH, provider, SIP credential, or media-storage data.
- A rollback path changes database state without recording the prior active version.

## Review Questions

- Which component owns the business decision?
- Is this desired state, runtime state, a runtime-generated artifact, or an audit/event record?
- Can this path activate runtime behavior without publish?
- Can an AI agent or workflow reach a broader surface than intended?
- Can active runtime state be regenerated from PostgreSQL after a failure?
- Does the change preserve tenant isolation and actor identity in audit records?
