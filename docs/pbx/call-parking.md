# Call Parking — Design

Status: **Designed, not implemented.**
Priority: P1 — required for production PBX completeness; not a public alpha/beta gate.

---

## Goal

Allow tenant administrators to configure call parking lots so that callers can
park active calls and retrieve them by dialing a slot code from any phone.

---

## User Stories

- As a receptionist, I want to park an incoming call so a colleague can pick it up
  by dialing a retrieval code from their desk phone.
- As a tenant admin, I want to define parking lot `7000–7099` so my team has 100
  slots available.
- As a tenant admin, I want parked calls to ring back to the original receptionist
  after 60 seconds if unclaimed.
- As an operator, I want to see which parking slots are occupied in the live
  dashboard.
- As an auditor, I want to see when each call was parked, retrieved, or timed out.

---

## Non-Goals

- Call parking does not expose raw ESL park commands to the UI or MCP.
- Parking lot configuration does not live in FreeSWITCH XML files — it lives in
  PostgreSQL and is served via `mod_xml_curl`.
- Cross-tenant parking slot visibility is impossible.

---

## Domain Model

### ParkingLot

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → tenants |
| `name` | text | Human label |
| `slot_range_start` | int | First slot number, e.g. 7000 |
| `slot_range_end` | int | Last slot number, e.g. 7099 |
| `retrieve_prefix` | text | Optional DTMF prefix for retrieval |
| `timeout_seconds` | int | How long before parked call times out |
| `timeout_target_type` | text | `extension` / `queue` / `ivr_flow` / `hangup` |
| `timeout_target_id` | UUID | Target ID for timeout routing |
| `music_on_hold` | text | Prompt asset reference or `default` |
| `status` | enum | `active` / `disabled` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### ParkingSlot

Derived view — not a separately persisted table. Slots are computed from
`slot_range_start .. slot_range_end` within the lot. A slot is occupied when a
`parked_calls` record exists for it.

### ParkedCall

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → tenants |
| `parking_lot_id` | UUID | FK → parking_lots |
| `slot_number` | int | Occupied slot |
| `call_id` | text | FreeSWITCH call UUID |
| `parked_by_extension_id` | UUID | FK → extensions (optional) |
| `parked_at` | timestamptz | |
| `timeout_at` | timestamptz | `parked_at + timeout_seconds` |
| `retrieved_at` | timestamptz | Null until retrieved |
| `retrieved_by_extension_id` | UUID | FK → extensions (optional) |
| `status` | enum | `parked` / `retrieved` / `timed_out` / `abandoned` |

---

## API Design

All endpoints are tenant-scoped.

### Parking lot management

```
GET    /api/v1/parking-lots
POST   /api/v1/parking-lots
GET    /api/v1/parking-lots/:id
PATCH  /api/v1/parking-lots/:id
DELETE /api/v1/parking-lots/:id
```

### Parked calls (runtime observation)

```
GET    /api/v1/parking-lots/:id/parked-calls
GET    /api/v1/parked-calls/:id
```

### Runtime callbacks (FreeSWITCH → API, runtime-auth only)

```
POST   /api/v1/runtime/parking/park
POST   /api/v1/runtime/parking/retrieve
POST   /api/v1/runtime/parking/timeout
```

### Request Examples

**Create parking lot:**
```json
POST /api/v1/parking-lots
{
  "name": "Main Reception Parking",
  "slot_range_start": 7000,
  "slot_range_end": 7049,
  "retrieve_prefix": "7",
  "timeout_seconds": 60,
  "timeout_target_type": "extension",
  "timeout_target_id": "ext-reception-uuid",
  "music_on_hold": "default"
}
```

**Park runtime callback (Lua → API):**
```json
POST /api/v1/runtime/parking/park
{
  "node_id": "fs-node-1",
  "call_id": "abc123",
  "parking_lot_id": "lot-uuid",
  "caller_extension_id": "ext-uuid"
}
```

Response:
```json
{
  "slot_number": 7002,
  "timeout_at": "2026-06-03T12:01:00Z"
}
```

### Authorization

| Action | Required role |
|---|---|
| List/read lots | `tenant_viewer` or higher |
| Create/update lots | `tenant_admin` |
| View parked calls | `tenant_viewer` or higher |
| Runtime park/retrieve | Runtime HMAC node auth only |

---

## Database Design

```sql
CREATE TABLE parking_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  slot_range_start INT NOT NULL,
  slot_range_end INT NOT NULL,
  retrieve_prefix TEXT,
  timeout_seconds INT NOT NULL DEFAULT 60,
  timeout_target_type TEXT CHECK (timeout_target_type IN ('extension','queue','ivr_flow','hangup')),
  timeout_target_id UUID,
  music_on_hold TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (slot_range_end >= slot_range_start),
  CHECK (slot_range_end - slot_range_start <= 999)
);

CREATE TABLE parked_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  parking_lot_id UUID NOT NULL REFERENCES parking_lots(id),
  slot_number INT NOT NULL,
  call_id TEXT NOT NULL,
  parked_by_extension_id UUID,
  parked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  timeout_at TIMESTAMPTZ NOT NULL,
  retrieved_at TIMESTAMPTZ,
  retrieved_by_extension_id UUID,
  status TEXT NOT NULL DEFAULT 'parked'
    CHECK (status IN ('parked','retrieved','timed_out','abandoned')),
  UNIQUE (tenant_id, parking_lot_id, slot_number, status)
    WHERE status = 'parked'
);

CREATE INDEX ON parking_lots (tenant_id);
CREATE INDEX ON parked_calls (tenant_id, status);
CREATE INDEX ON parked_calls (parking_lot_id, slot_number) WHERE status = 'parked';
```

---

## FreeSWITCH Integration

### Approach options

Two approaches are possible:

**Option A: FreeSWITCH built-in parking (`mod_dptools park` + `valet_park`).**
FreeSWITCH has a `valet_park` application that assigns slots. The Go agent can
listen for `CHANNEL_PARK` and `CHANNEL_UNPARK` events over ESL to maintain the
`parked_calls` table. This is the preferred approach because it uses stock
FreeSWITCH primitives and requires no new Lua executor complexity.

**Option B: API-managed Lua-based parking.**
Lua executor parks by holding the channel with `park` application, API assigns
slot, and Lua bridges the retrieve call. More portable but bypasses FreeSWITCH's
native MoH in park state.

**Recommended: Option A** (stock FreeSWITCH valet_park + Go agent event listener).

### Dialplan projection

The parking lot config is projected into a dialplan context section served via
`mod_xml_curl`. The dialplan routes `slot_range_start .. slot_range_end` to
`valet_park` or `valet_park_retrieve` applications. The parking lot ID and tenant
ID are passed as channel variables resolved by the API at dialplan-fetch time.

### Go agent role

The Go agent subscribes to `CHANNEL_PARK` and `CHANNEL_UNPARK` FreeSWITCH events
via ESL and calls:

- `POST /api/v1/runtime/parking/park` on park event.
- `POST /api/v1/runtime/parking/retrieve` on unpark event.
- `POST /api/v1/runtime/parking/timeout` on park timeout.

The API updates `parked_calls` status and writes audit events.

---

## Runtime Behavior

```
1. Extension A parks a call → dials feature code *71 (or transfers to slot 7001)
2. FreeSWITCH parks the call using valet_park
3. Go agent detects CHANNEL_PARK → POSTs to /api/v1/runtime/parking/park
4. API writes parked_calls record (status = parked, timeout_at = now+60s)
5. API writes audit event: call_parked
6. Extension B dials 7001 → FreeSWITCH unparks → connects to A's caller
7. Go agent detects CHANNEL_UNPARK → POSTs to /api/v1/runtime/parking/retrieve
8. API updates parked_calls (status = retrieved, retrieved_at = now)
9. API writes audit event: call_retrieved
10. If 60s elapsed without retrieval → FreeSWITCH transfers to timeout_target
11. Go agent detects timeout → POSTs to /api/v1/runtime/parking/timeout
12. API updates parked_calls (status = timed_out)
13. API writes audit event: call_park_timed_out
```

---

## UI/UX Design

### Parking lot config page

- List: lot name, slot range, timeout, status.
- Create / edit form with slot range, timeout target, MoH.
- Conflict warning if slot ranges overlap with other lots.

### Live parked calls panel (in Observability HUD)

- Per-slot occupancy view.
- Shows: slot number, caller ID, time parked, time remaining.
- Retrieval instruction: "Dial 7002 from any phone."
- Timeout warning when < 10s remaining.
- Refreshes via existing SSE operational snapshot.

### Audit trail

Per-lot audit log: who created/modified the lot, per-call park/retrieve/timeout
events.

---

## MCP/n8n Exposure

| Tool / event | Allowed | Notes |
|---|---|---|
| `list_parking_lots` | Yes | Read-only |
| `list_parked_calls` | Yes | Read-only |
| n8n webhook: `parking.call_parked` | Yes | Informational |
| n8n webhook: `parking.call_retrieved` | Yes | Informational |
| n8n webhook: `parking.call_timed_out` | Yes | Informational |
| Park/retrieve via MCP | No | Runtime-only via FreeSWITCH |

---

## Security and Tenant Isolation

- `parking_lots` and `parked_calls` always filtered by `tenant_id`.
- Go agent runtime callbacks are HMAC-authenticated and node-scoped.
- Slot collision between tenants is impossible: slot ranges are per-tenant.
- Parked call retrieval requires the caller to be on the same FreeSWITCH node
  and tenant context — enforced at dialplan level.

---

## Audit Events

| Event | Trigger |
|---|---|
| `parking_lot.created` | Lot created |
| `parking_lot.updated` | Lot config changed |
| `parking_lot.disabled` | Lot disabled |
| `call.parked` | Call parked in a slot |
| `call.park_retrieved` | Parked call retrieved |
| `call.park_timed_out` | Parked call timed out |
| `call.park_abandoned` | Parked call abandoned (caller hung up) |

---

## Approval Policy Integration

Parking lot configuration changes do not require approval by default, but the
`requires_approval` flag may be added at the tenant policy level for environments
where parking lot changes can disrupt active call flows.

---

## Testing Strategy

| Test type | Required |
|---|---|
| Unit — slot assignment | No double-assignment to same slot within one lot |
| Unit — timeout calculation | `timeout_at` is always `parked_at + timeout_seconds` |
| Integration — tenant isolation | Tenant A cannot view or affect Tenant B parked calls |
| Integration — slot collision | Overlapping slot ranges in same tenant rejected |
| Integration — Go agent event handling | Park/retrieve/timeout callbacks update `parked_calls` correctly |
| Integration — audit | Every park/retrieve/timeout writes an audit event |
| Runtime smoke | A call is parked on real FreeSWITCH, Go agent picks up event, API record is updated |

---

## Runtime Evidence Required

Before production promotion:

- Live FreeSWITCH smoke: a call is parked via valet_park, Go agent ingests the
  CHANNEL_PARK event, API `parked_calls` record is created, slot is retrievable.
- Timeout evidence: a parked call times out, `parked_calls.status` transitions to
  `timed_out`, audit event is written.
- Evidence artifact tied to the RC commit.

---

## Release Stage Recommendation

| Stage | Recommendation |
|---|---|
| Public alpha | Not required |
| Public beta | Not a gate — can ship without |
| Production | P1 for PBX completeness; requires implementation + runtime smoke |

---

## Open Questions

- Should parking lots support inter-lot retrieval (retrieve a call parked in lot
  A from lot B using the same lot B slot range)?
- Should the operator be able to manually retrieve or abandon a parked call from
  the dashboard without a phone?
- Should park-on-busy (auto-park when extension is busy) be a v2 feature?
- Is Go agent event-based ingestion sufficient, or is API polling needed as a
  fallback?
