# PBX Completeness Layer

Status: **Partially implemented.** The API and schema now implement most of this
layer, but the product surface is uneven. Several areas remain API-first,
operator-UI-light, or still depend on runtime evidence rather than broad product
workflow maturity.

Last updated: 2026-06-04.

---

## Purpose

manageCallAI is an AI-native telecom control plane. Its initial scope covers
IVR flows, routing, call groups, queues, voicemail boxes, SIP trunk management,
outbound calls, fraud policy, observability, and a complete safety lifecycle
(`draft -> validate -> simulate -> publish -> rollback`).

The **PBX Completeness Layer** extends this foundation into a more complete PBX
control plane. The goal is not to replicate FusionPBX. The goal is to add the
critical missing primitives that make manageCallAI usable as the primary
management interface for a FreeSWITCH-based telephone system, without
compromising the safety model.

---

## Design boundaries

All features in this layer follow the same rules as the rest of the system:

| Principle | Application to PBX layer |
|---|---|
| API owns desired state | Feature codes, parking lots, conference rooms, and runtime operations are stored in PostgreSQL, not in FreeSWITCH XML files |
| FreeSWITCH is runtime-only | FreeSWITCH executes behavior derived from published desired state; it does not hold authoritative config |
| Lua is a thin executor | Lua entry points for feature code handling and parking retrieval call back to the API runtime endpoint; no business logic lives in Lua |
| Go agent handles ESL | Gateway reloads, conference status, and runtime queries flow through the Go agent, not arbitrary ESL from the API |
| MCP/n8n stay narrower than REST | Read-only views and safe lifecycle operations only; no raw ESL/XML/module commands |
| Every live-impacting action is audited | Feature code publish, gateway reload, conference create, self-service forwarding change, and runtime apply results write audit events |
| Tenant isolation is absolute | Every object is tenant-scoped; cross-tenant access is impossible at the code level |
| Approval policy applies | Actions that disrupt live calls support policy-gated approval workflows where applicable |

---

## Feature areas

| Feature | Design doc | Current status | Priority |
|---|---|---|---|
| Feature codes | [feature-codes.md](feature-codes.md) | Implemented in API/runtime and tenant admin web UI | P1 |
| Call parking | [call-parking.md](call-parking.md) | Implemented in API/runtime, not fully productized in web UI | P1 |
| Native conferencing | [conferencing.md](conferencing.md) | Implemented in API/runtime, not fully productized in web UI | P1 |
| Gateway reload on trunk change | [gateway-reload-on-trunk-change.md](gateway-reload-on-trunk-change.md) | Implemented for apply-request lifecycle; operator workflow remains partial | P0 |
| End-user self-service portal | [end-user-self-service.md](end-user-self-service.md) | Implemented in API/policy layer; full end-user product surface remains partial | P2 |
| FreeSWITCH runtime management | [freeswitch-runtime-management.md](freeswitch-runtime-management.md) | Read-only/runtime-status portions implemented; broader controlled-action UX remains partial | P1/P2 |

Data model and API proposal for all six areas:
[pbx-data-model-and-api-proposal.md](pbx-data-model-and-api-proposal.md)

---

## What is already implemented

These features exist in code and tests today:

- SIP trunk CRUD with AES-256-GCM encrypted credentials
- gateway XML served via `mod_xml_curl` `/freeswitch/configuration`
- outbound call dispatch via ESL originate
- tenant-scoped IVR flows, inbound/outbound routes, call groups, queues, and voicemail
- FreeSWITCH directory and dialplan via `mod_xml_curl`
- extension SIP registration via directory lookup
- per-node SIP profile fields in DB
- feature code CRUD, validate, publish, disable, and runtime execute callback
- parking lot CRUD plus runtime park/retrieve/timeout callbacks
- conference room CRUD, participant runtime snapshot callbacks, and tenant admin UI
- self-service `/me/*` APIs for DND and call forwarding
- node status snapshots and tenant/platform gateway status endpoints
- runtime apply request lifecycle for trunk-driven gateway reload/rescan work

What is **not** yet fully productized:

- SIP profile management API/UI
- parking-lot management in the web UI
- full end-user portal experience
- full controlled runtime-action workflow in the web UI
- carrier/operator test workflows in the web UI

---

## Roadmap slices

| Slice | Feature | Current state |
|---|---|---|
| SLICE-60 | Feature codes | Implemented; web productization remains |
| SLICE-61 | Call parking | Implemented; web productization remains |
| SLICE-62 | Native conferencing | Implemented; web productization remains |
| SLICE-63 | Gateway reload on trunk change | Implemented for API/runtime; richer operator workflow remains |
| SLICE-64 | End-user self-service portal | Implemented in API/policy layer; fuller end-user UX remains |
| SLICE-65 | SIP profile management API + UI | Still open |
| SLICE-66 | Safe FreeSWITCH runtime management | Partial; read-only/status portions implemented |

---

## Cross-cutting requirements before calling this layer complete

1. Strong admin UI for the implemented API/runtime features
2. Runtime evidence for live-call-affecting operations on current candidate tags
3. Capability gating and tenant-isolation tests kept current
4. Audit trail coverage for every live-impacting action
5. OpenAPI and SDK coverage kept aligned with implementation
6. Operator-facing apply/evidence workflows that expose risk clearly

---

## What this layer explicitly does not include

| Out of scope | Reason |
|---|---|
| Raw ESL command pass-through | Breaks the safety model |
| Direct XML dialplan editing | API owns desired state |
| Arbitrary `lua_run` scripts | Lua is a thin executor only |
| Arbitrary module load/unload | Allowlisted safe actions only |
| Softphone / WebRTC client | Separate product surface |
| Billing / invoicing | External system concern |
| Device firmware management | Outside PBX control-plane scope |
| White-label theming | Not part of the core PBX completeness goal |
