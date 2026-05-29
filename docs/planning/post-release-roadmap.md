# Post-Release Roadmap

## Purpose

This document captures intentionally deferred work that was excluded from the v1
release to protect scope. It is the authoritative parking lane for expansion tracks
that should be planned only after the first release is stable and deployed.

These workstreams are now decomposed into explicit planning slices:

- Workstream A -> `SLICE-15`
- Workstream B -> `SLICE-16`
- Workstream C -> `SLICE-17`
- Workstream D -> `SLICE-18`
- Workstream E -> `SLICE-19`
- Workstream F -> `SLICE-20`
- Workstream G -> `SLICE-21`

Nothing here should pull forward into the v1 slice sequence without explicit
reprioritisation. Reading this document alongside the v1 boundaries makes the
deliberate trade-offs visible.

---

## V1 Release Boundary (what shipped)

| Domain | What v1 delivers |
|--------|-----------------|
| IVR authoring | CRUD, validation, simulation, approval-aware publish, rollback, visual builder |
| IVR node types | `start`, `play_prompt`, `play_collect`, `switch`, `transfer_extension`, `hangup` |
| Routing | Inbound DID → published IVR, extension bridge, call group (simultaneous/sequential) |
| FreeSWITCH | Stock FreeSWITCH runtime, thin Lua loop, ESL agent event ingestion |
| Automation | n8n API key auth, IVR lifecycle webhooks, MCP stdio server (7 tools) |
| Approval | Per-tenant approval policy, human-in-the-loop publish gate |
| Observability | Call events list, approval queue view, webhook subscription list |

---

## Workstream A — Advanced IVR Node Types

**Why deferred:** The MVP node set covers the core IVR lifecycle. Richer node types
require runtime resolver changes and new FreeSWITCH Lua handlers that should build on
a proven runtime foundation, not race with it.

| Item | Notes |
|------|-------|
| `gather` with speech recognition | Requires ASR integration (e.g., Deepgram, Google Speech) |
| `voicemail_drop` | Records caller message, stores audio, fires event on completion |
| `queue` node | Holds caller in queue, fires agent-ready events via runtime resolver |
| `transfer_external` | SIP URI or PSTN transfer, requires trunk policy integration |
| `set_variable` | Sets channel variable for downstream routing decisions |
| `http_request` | External HTTP call during call flow — needs timeout and failure semantics |
| `sub_flow` | Calls another published IVR flow as a subroutine |
| `a_b_test` | Routes a percentage of callers to alternate flow versions |

**Pre-requisite:** Runtime resolver must handle session state for multi-step flows
reliably before new node types are added.

---

## Workstream B — Queue and Voicemail Desired-State Models

**Why deferred:** These are new desired-state entities with their own lifecycle,
not extensions of the IVR flow model. They require independent schema, resolver
contracts, and runtime plumbing.

| Item | Notes |
|------|-------|
| `queues` resource | CRUD, agent assignment, skill-based routing, SLA thresholds |
| Queue session model | Caller position, hold music, max wait, spillover target |
| `voicemail_boxes` resource | Per-extension or per-group, storage backend, greeting management |
| Voicemail notification | Webhook event on new voicemail, email notification option |
| Transcript / AI summary | Optional AI-generated transcript and summary on voicemail receipt |

---

## Workstream C — Schedule-Aware and Conditional Routing

**Why deferred:** Business-hours routing requires a schedule model with timezone
awareness. This adds a new desired-state entity that inbound route resolution depends
on.

| Item | Notes |
|------|-------|
| `schedules` resource | Named time windows with timezone, recurring weekly patterns |
| Business-hours condition node | IVR `switch` variant that branches on schedule match |
| Holiday overrides | One-off date exceptions that override the weekly schedule |
| Caller ID condition node | Branch by caller number prefix or CNAM lookup result |
| DID pool routing | Round-robin or least-cost selection across multiple DIDs |

---

## Workstream D — Outbound Routing and Trunk Policy

**Why deferred:** Outbound routing introduces dial-out risk (cost, fraud, compliance)
and trunk selection logic that is orthogonal to the inbound desired-state model v1
proves.

| Item | Notes |
|------|-------|
| Outbound route resource | Tenant-scoped dial rules, prefix matching, trunk selection |
| SIP trunk policy | Failover chain, codec negotiation, DTMF mode per trunk |
| Click-to-call API | Initiate supervised outbound call from API, returns call ID |
| Call supervision | Barge, whisper, monitor — requires ESL channel control |
| CNAM/DNCL integration | Outbound caller ID enrichment and Do-Not-Call-List checking |
| Fraud rate limits | Per-tenant per-minute outbound rate caps with automatic circuit breaking |

---

## Workstream E — Observability and Operations

**Why deferred:** v1 ships call event list and approval queue. Richer operations
surfaces should be driven by operator feedback on the initial release.

| Item | Notes |
|------|-------|
| IVR session replay | Step-by-step replay of a recorded runtime session from DB |
| Validation history | Timeline of all validation attempts per flow version |
| Publish audit trail | Who requested, who approved, when — visible in operator UI |
| Call recording | FreeSWITCH `record_session`, storage backend, playback UI |
| Real-time dashboard | Active call count, queue depth, agent availability |
| Export / reporting | CSV/JSON export of call events, SLA metrics per queue |
| Structured audit log | Immutable append-only log of all tenant mutations with actor/IP |
| Platform metrics | Cross-tenant call volume, error rates, FreeSWITCH health telemetry |

---

## Workstream F — Automation and AI Depth

**Why deferred:** v1 proves the automation boundary (API keys, webhooks, MCP tools).
The next tier requires at-least-once delivery guarantees and richer AI agent tooling
that builds on the proven boundary.

| Item | Notes |
|------|-------|
| Webhook retry with backoff | Exponential backoff queue for failed deliveries (Postgres-backed or Redis) |
| Delivery receipts | Per-delivery status record: attempted, succeeded, failed, retried |
| n8n trigger node package | Custom n8n community node for native ManageCallAI events |
| MCP approval tools | `list_pending_approvals`, `approve_flow`, `reject_flow` tools for agent-in-the-loop |
| MCP call management tools | Read-only call session tools: `get_active_calls`, `get_session_trace` |
| AI-assisted flow generation | `suggest_flow` MCP tool that produces a draft graph from a natural language description |
| Prompt asset MCP tools | `list_prompts`, `create_prompt`, `update_prompt_text` for AI-driven prompt authoring |
| AI regression testing | Automated simulation of published flows against a stored test case library |

---

## Workstream G — Enterprise and Multi-Tenant Hardening

**Why deferred:** The v1 runtime is single-agent-per-tenant. Multi-region and
compliance capabilities are post-release concerns tied to enterprise customer demand.

| Item | Notes |
|------|-------|
| Multi-region FreeSWITCH | Multiple ESL agents per tenant, routing affinity |
| SSO / SAML integration | Federated identity for enterprise tenants |
| Role expansion | Sub-tenant roles beyond `tenant_admin` (e.g., `flow_author`, `approver_only`) |
| Data residency controls | Per-tenant storage region selection |
| SOC 2 / ISO 27001 evidence | Automated evidence collection from audit log |
| SLA reporting | Uptime, latency, and error-rate SLAs per tenant |

---

## Planning Rule

None of the above enters a sprint or becomes an implementation slice until:

1. v1 is deployed and stable
2. The item has been explicitly reprioritised against the current backlog
3. A new slice document is written with concrete exit criteria

Items in this document are captured intent, not commitments.
