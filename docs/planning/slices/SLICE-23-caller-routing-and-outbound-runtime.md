# SLICE-23 Caller Routing and Outbound Runtime Integration

## Goal

Close the remaining gaps from SLICE-17 and SLICE-18 that were deliberately deferred
to keep those slices minimal and safe.

## Status

**COMPLETED** — 2026-05-29

### Shipped

- `caller_id_match` IVR node type added to structural validator, simulation, and runtime resolver
  - Fields: `prefixes` (non-empty string array), `match_node_id`, `no_match_node_id`
  - Structural: validates branch node IDs exist; rejects empty prefix list
  - Semantic (in `validate()`): each prefix checked against E.164 prefix pattern `/^\+?[0-9]{1,20}$/`
  - Simulation: matches `scenario.caller_number` using `String.startsWith`; falls through to `no_match_node_id` when no caller or no match
  - Runtime: same prefix-matching logic against live `caller_number` from session
- DB migration `0016_outbound_call_requests.sql` — `outbound_call_requests` table (tenant_id, extension_id, dial_number, route_id nullable, sip_trunk_id nullable, status pending/dispatched/failed)
- Click-to-call API (`POST /api/v1/runtime/outbound`) — JWT + `tenant.outbound_calls.create` capability; validates extension active, resolves route by prefix if route_id omitted, validates resolved trunk active; returns call reference
- ESL polling endpoint (`GET /api/v1/runtime/outbound/pending`) — runtime token auth; returns pending call requests for the ESL agent
- Status update endpoint (`POST /api/v1/runtime/outbound/:id/status`) — runtime token auth; ESL marks calls dispatched or failed
- Capability `tenant.outbound_calls.create` added to API and web capabilities
- 12 service-layer tests for outbound call flow; 5 new validation tests for `caller_id_match`

## Context

SLICE-17 introduced `business_hours` IVR branching but left out caller-number based
routing, which was listed in its scope. SLICE-18 introduced the outbound route
desired-state model and backend resolution but left the FreeSWITCH integration and
click-to-call API to a future slice.

This slice closes those two gaps in one focused delivery.

## Scope

### Caller-number routing node (from SLICE-17 remainder)

- `caller_id_match` IVR node type: branch by caller number prefix
- Fields: `prefixes` (list of strings), `match_node_id`, `no_match_node_id`
- Structural validation: validate branch node IDs exist
- Semantic validation: prefix format check (same rules as outbound route)
- Simulation: uses `scenario.caller_number` to evaluate branches
- Runtime resolver: evaluates against live session caller number

### Click-to-call API

- `POST /api/v1/runtime/outbound` — initiate a supervised outbound call
- Payload: `extension_id` (origin), `dial_number` (destination), optional `route_id`
- Resolves outbound route if `route_id` not provided
- Returns a call reference; runtime places the call via FreeSWITCH ESL
- JWT auth + `tenant.outbound_calls.create` capability
- Validates that the resolved trunk is active before dispatching

### Outbound route → FreeSWITCH integration

- ESL agent uses the `/api/v1/outbound-routes/resolve` internal endpoint when dialing
- Dialplan projection: translate resolved trunk into FreeSWITCH SIP gateway selection
- Keep raw ESL/XML out of the public API surface (backend only)
- No new public endpoint; integration is in the Lua/ESL agent layer

## Depends On

- `SLICE-17`
- `SLICE-18`
- `SLICE-04` (runtime resolver pattern)
- `SLICE-05` (FreeSWITCH runtime loop)

## Parallel With

- `SLICE-19`
- `SLICE-20`

## Unblocks

- supervised outbound calls from operator UI
- realistic call-center dial-out scenarios
- caller-based IVR personalisation

## Exit Criteria

- `caller_id_match` nodes pass validation, simulation, and runtime resolution
- click-to-call endpoint initiates a call and returns a traceable call reference
- outbound route resolution is used by the ESL agent when dialing out
- no raw FreeSWITCH primitives exposed through public API

## Out Of Scope

- predictive dialer or mass outbound
- DNCL / compliance list integration (covered elsewhere if ever)
- real-time rate limit enforcement infrastructure
