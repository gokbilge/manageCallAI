# PBX Completeness Layer

Status: **Designed — not implemented.** None of the features described in this
directory are production-ready. All require implementation, tests, and
runtime evidence before any promotion beyond alpha.

Last updated: 2026-06-03.

---

## Purpose

manageCallAI is an AI-native telecom control plane. Its initial scope covers
IVR flows, routing, call groups, queues, voicemail boxes, SIP trunk management,
outbound calls, fraud policy, observability, and a complete safety lifecycle
(draft → validate → simulate → publish → rollback).

The **PBX Completeness Layer** extends this foundation into a more complete
PBX control plane. The goal is not to replicate FusionPBX — it is to add the
critical missing primitives that make manageCallAI usable as the primary
management interface for a FreeSWITCH-based telephone system, without
compromising the safety model.

---

## Design boundaries (unchanged from core architecture)

All new features in this layer follow the same non-negotiable rules as the rest
of the system:

| Principle | Application to PBX layer |
|---|---|
| API owns desired state | Feature codes, parking lots, conference rooms, and runtime operations are stored in PostgreSQL, not in FreeSWITCH XML files |
| FreeSWITCH is runtime-only | FreeSWITCH executes behavior derived from published desired state; it does not hold authoritative config |
| Lua is a thin executor | New Lua entry points for feature code handling and parking retrieval call back to the API runtime endpoint; no business logic lives in Lua |
| Go agent handles ESL | Gateway reloads, conference status, and runtime queries flow through the Go agent, not arbitrary ESL from the API |
| MCP/n8n stay narrower than REST | Read-only views and safe lifecycle operations only; no raw ESL/XML/module commands |
| Every live-impacting action is audited | Feature code publish, gateway reload, conference create, self-service forwarding change — all write audit events |
| Tenant isolation is absolute | Every object is tenant-scoped; cross-tenant access is impossible at the code level |
| Approval policy applies | Actions that disrupt live calls support policy-gated approval workflows |

---

## Feature areas

| Feature | Design doc | Status | Priority |
|---|---|---|---|
| Feature codes | [feature-codes.md](feature-codes.md) | Designed, not implemented | P1 |
| Call parking | [call-parking.md](call-parking.md) | Designed, not implemented | P1 |
| Native conferencing | [conferencing.md](conferencing.md) | Designed, not implemented | P1 |
| Gateway reload on trunk change | [gateway-reload-on-trunk-change.md](gateway-reload-on-trunk-change.md) | Designed, not implemented | P0 |
| End-user self-service portal | [end-user-self-service.md](end-user-self-service.md) | Designed, not implemented | P2 |
| FreeSWITCH runtime management | [freeswitch-runtime-management.md](freeswitch-runtime-management.md) | Designed, not implemented | P1/P2 |

Data model and API proposal for all six areas: [pbx-data-model-and-api-proposal.md](pbx-data-model-and-api-proposal.md)

---

## What is already implemented (not part of this layer)

These features exist in code, are tested, and are part of the current alpha:

- SIP trunk CRUD with AES-256-GCM encrypted credentials
- Gateway XML served via `mod_xml_curl` `/freeswitch/configuration` endpoint
- Outbound call dispatch via ESL originate (Go agent `CommandClient`)
- Tenant-scoped IVR flows, inbound/outbound routes, call groups, queues, voicemail
- FreeSWITCH directory and dialplan via `mod_xml_curl`
- Extension SIP registration (mod_xml_curl directory)
- Per-node SIP profile fields in DB (migration 0044)

What is **not** yet wired up:
- SIP profile management API/UI (fields exist in DB, no API layer)
- Gateway reload trigger after trunk CRUD (documented here, not implemented)
- Feature codes, parking, conferencing, self-service, runtime management

---

## Roadmap slices

| Slice | Feature | Gate |
|---|---|---|
| SLICE-60 | Feature codes | Public beta |
| SLICE-61 | Call parking | Public beta |
| SLICE-62 | Native conferencing | Public beta |
| SLICE-63 | Gateway reload on trunk change | Public beta / production |
| SLICE-64 | End-user self-service portal | Production |
| SLICE-65 | SIP profile management API + UI | Public beta |
| SLICE-66 | Safe FreeSWITCH runtime management | Production |

---

## Cross-cutting implementation requirements

Before any feature in this layer is promoted to beta or production:

1. **Unit tests** — service-layer business logic covered
2. **Integration tests** — tenant isolation matrix covered (tenant A cannot access tenant B resources)
3. **FreeSWITCH runtime evidence** — where the feature touches a live call path, a passing smoke run with evidence artifact is required
4. **Audit trail verification** — every live-impacting action produces a `tenant_audit_log` entry, tested
5. **Capability gating** — new capabilities added to the capability matrix and drift-checked in CI
6. **OpenAPI contract** — new routes in `packages/contracts`, generated into `docs/api/openapi.yaml`

---

## What this layer explicitly does not include

| Out of scope | Reason |
|---|---|
| Raw ESL command pass-through | Breaks the safety model |
| Direct XML dialplan editing | API owns desired state |
| FreeSWITCH `lua_run` arbitrary scripts | Lua is a thin executor only |
| Arbitrary module load/unload | Allowlisted safe actions only |
| Softphone / WebRTC client | Separate product |
| Billing / invoice generation | External billing system integration |
| Device firmware management | Beyond PBX control scope |
| White-label theming | Out of scope for v1 |
