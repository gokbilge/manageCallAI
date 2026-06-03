# Native Conferencing — Design

Status: **Designed, not implemented.**
Priority: P1 — PBX completeness; production requires FreeSWITCH runtime evidence.

---

## Goal

Allow tenant administrators to configure conference rooms backed by FreeSWITCH
`mod_conference`. Conference rooms are desired-state objects managed through the
control plane. FreeSWITCH executes conference behavior; no raw `conference` CLI
commands are exposed to the UI, MCP, or n8n.

---

## User Stories

- As a tenant admin, I want to create a conference room at extension `8100` with a
  moderator PIN and a guest PIN.
- As a tenant admin, I want to set a maximum of 20 participants per room.
- As a tenant admin, I want to require a moderator to join before guests hear
  anything.
- As a tenant admin, I want participants to be announced when they join or leave.
- As an operator, I want to see how many participants are in each room.
- As an auditor, I want a log of when rooms were created, modified, and when calls
  joined or left (if event support exists).
- As an AI agent (MCP), I want to list conference rooms and their current status.

---

## Non-Goals

- No raw `conference` ESL command passthrough.
- No arbitrary conference moderator control via API (kick, mute individual
  participants) unless explicitly designed with approval gate and audit in a
  future slice.
- No recording of conference calls unless the recording policy is explicitly
  set and the recording subsystem is wired.
- No WebRTC/browser-based conferencing — FreeSWITCH handles media.

---

## Domain Model

### ConferenceRoom

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → tenants |
| `room_number` | text | Dialable number, e.g. `8100` |
| `name` | text | Human label |
| `pin_hash` | text | Bcrypt hash of guest PIN (nullable = no PIN) |
| `moderator_pin_hash` | text | Bcrypt hash of moderator PIN (nullable) |
| `max_participants` | int | Limit on concurrent participants |
| `recording_policy` | enum | `disabled` / `on_join` / `moderator_requested` |
| `join_muted` | bool | Guests join muted by default |
| `announce_join_leave` | bool | Play join/leave announcement sounds |
| `music_on_hold` | text | MoH played while waiting for moderator |
| `wait_for_moderator` | bool | Guests wait in MoH until moderator joins |
| `status` | enum | `active` / `disabled` |
| `created_by` | UUID | FK → users |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Note: PINs are never stored in plaintext. API accepts plaintext on create/update,
hashes before storage. API never returns hashed or plaintext PINs in responses.

### ConferenceParticipantSnapshot (operational, not desired state)

An optional runtime snapshot record maintained by the Go agent if FreeSWITCH
`mod_conference` event support is available:

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | |
| `conference_room_id` | UUID | |
| `call_id` | text | FreeSWITCH call UUID |
| `joined_at` | timestamptz | |
| `left_at` | timestamptz | Null if still present |
| `is_moderator` | bool | |
| `status` | enum | `joined` / `left` |

This is operational data only. It is not authoritative desired state.

---

## API Design

All endpoints are tenant-scoped.

### Conference room management

```
GET    /api/v1/conference-rooms
POST   /api/v1/conference-rooms
GET    /api/v1/conference-rooms/:id
PATCH  /api/v1/conference-rooms/:id
DELETE /api/v1/conference-rooms/:id

# Runtime observation (operational, not desired state)
GET    /api/v1/conference-rooms/:id/participants
```

### Runtime callbacks (Go agent → API, runtime-auth only)

```
POST   /api/v1/runtime/conference/joined
POST   /api/v1/runtime/conference/left
```

### Request Examples

**Create room:**
```json
POST /api/v1/conference-rooms
{
  "room_number": "8100",
  "name": "Board Room",
  "pin": "1234",
  "moderator_pin": "9876",
  "max_participants": 20,
  "recording_policy": "disabled",
  "join_muted": false,
  "announce_join_leave": true,
  "wait_for_moderator": true,
  "music_on_hold": "default"
}
```

**Response (PIN never returned):**
```json
{
  "id": "conf-room-uuid",
  "tenant_id": "tenant-uuid",
  "room_number": "8100",
  "name": "Board Room",
  "max_participants": 20,
  "recording_policy": "disabled",
  "join_muted": false,
  "announce_join_leave": true,
  "wait_for_moderator": true,
  "music_on_hold": "default",
  "status": "active",
  "created_at": "...",
  "updated_at": "..."
}
```

Note: `pin_hash` and `moderator_pin_hash` fields are never included in responses.

### Authorization

| Action | Required role |
|---|---|
| List/read rooms | `tenant_viewer` or higher |
| List participants (snapshot) | `tenant_operator` or higher |
| Create/update rooms | `tenant_admin` |
| Delete rooms | `tenant_admin` |
| Runtime callbacks | Runtime HMAC node auth only |

---

## Database Design

```sql
CREATE TABLE conference_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  room_number TEXT NOT NULL,
  name TEXT NOT NULL,
  pin_hash TEXT,
  moderator_pin_hash TEXT,
  max_participants INT NOT NULL DEFAULT 50,
  recording_policy TEXT NOT NULL DEFAULT 'disabled'
    CHECK (recording_policy IN ('disabled','on_join','moderator_requested')),
  join_muted BOOLEAN NOT NULL DEFAULT FALSE,
  announce_join_leave BOOLEAN NOT NULL DEFAULT TRUE,
  music_on_hold TEXT NOT NULL DEFAULT 'default',
  wait_for_moderator BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, room_number)
);

CREATE TABLE conference_participant_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  conference_room_id UUID NOT NULL REFERENCES conference_rooms(id),
  call_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  is_moderator BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'joined' CHECK (status IN ('joined','left'))
);

CREATE INDEX ON conference_rooms (tenant_id);
CREATE INDEX ON conference_participant_snapshots (tenant_id, conference_room_id);
CREATE INDEX ON conference_participant_snapshots (conference_room_id, status);
```

---

## FreeSWITCH Integration

### mod_conference profile generation

On room creation/update, the API generates a `conference.conf.xml` fragment for
the tenant's rooms. This fragment is served via `mod_xml_curl` from the existing
`/api/v1/freeswitch/configuration` endpoint (the same `mod_xml_curl` path that
already serves gateway and profile config).

Example generated conference profile fragment:
```xml
<configuration name="conference.conf" description="manageCallAI conferences">
  <profiles>
    <profile name="tenant-uuid-8100">
      <param name="caller-id-name" value="Conference"/>
      <param name="max-members" value="20"/>
      <param name="energy-level" value="100"/>
      <param name="comfort-noise" value="1400"/>
      <param name="moh-sound" value="local_stream://moh"/>
      <param name="announce-count" value="2"/>
      <param name="suppress-events" value=""/>
    </profile>
  </profiles>
</configuration>
```

### Dialplan generation

The API generates a dialplan extension for each active conference room:

```xml
<extension name="conference_8100">
  <condition field="destination_number" expression="^8100$">
    <action application="conference" data="tenant-uuid-8100@tenant-uuid-8100"/>
  </condition>
</extension>
```

PIN validation happens through the `conference` application's built-in PIN
support — not through Lua.

### Go agent role (optional)

If `mod_conference` emits `CONFERENCE_DATA` or `CUSTOM` events via ESL, the Go
agent can:

1. Subscribe to `CUSTOM conference::maintenance` events.
2. POST `join` / `leave` events to `/api/v1/runtime/conference/joined` and
   `/api/v1/runtime/conference/left`.
3. API updates `conference_participant_snapshots`.

This provides the live participant view but is not required for core functionality.

---

## Runtime Behavior

```
1. Caller dials 8100
2. FreeSWITCH matches dialplan extension → conference application
3. FreeSWITCH prompts for guest PIN (if configured)
4. Caller enters PIN → verified by FreeSWITCH conference app
5. Caller joins conference room
6. If wait_for_moderator = true and no moderator: caller hears MoH
7. Moderator dials 8100 + moderator PIN → joins as moderator
8. MoH stops, conference begins
9. Go agent receives join/leave events → API updates snapshot
10. max_participants enforcement: FreeSWITCH rejects join if full
```

---

## UI/UX Design

### Conference room list

- Table: room number, name, max participants, status, recording policy.
- Active participant count if Go agent event support is available.

### Create/edit form

- Room number with uniqueness check.
- PIN fields (write-only inputs — never pre-populated on edit).
- PIN strength indicator.
- Moderator PIN (optional).
- Max participants, MoH, announce toggle, wait-for-moderator toggle.
- Recording policy selector with warning on `on_join`.

### PIN/credential handling

- PIN fields use `type="password"` and never show existing values.
- Edit form shows "PIN set — leave blank to keep unchanged" pattern.
- Confirm PIN before save.

### Participant view (if Go agent events available)

- Per-room participant count.
- List: call ID, joined time, moderator flag.
- Does not show caller ID beyond what is appropriate for the tenant.

### Recording policy indicator

- Warning badge if recording_policy ≠ disabled.
- Reminder that recording subsystem must be wired before `on_join` is effective.

### Audit trail

Per-room creation/update/delete log.

---

## MCP/n8n Exposure

| Tool / event | Allowed | Notes |
|---|---|---|
| `list_conference_rooms` | Yes | Read-only |
| `get_conference_room` | Yes | Read-only (no PIN fields) |
| Create/update via MCP | No | Admin-only operation |
| n8n webhook: `conference_room.created` | Yes | |
| n8n webhook: `conference_room.updated` | Yes | |
| n8n webhook: `conference.participant_joined` | Yes | If Go agent events enabled |
| n8n webhook: `conference.participant_left` | Yes | If Go agent events enabled |
| Raw `conference` ESL commands | Never | Explicitly out of scope |

---

## Security and Tenant Isolation

- All DB queries include `WHERE tenant_id = $tenantId`.
- PINs are hashed (bcrypt) before storage; never returned in responses.
- Room number uniqueness is per-tenant; room 8100 in Tenant A is independent from
  room 8100 in Tenant B.
- FreeSWITCH conference profile names include the tenant ID to prevent cross-tenant
  conference profile collisions on shared FreeSWITCH nodes.
- Go agent runtime callbacks are HMAC-authenticated.
- Participant snapshots are tenant-scoped.

---

## Audit Events

| Event | Trigger |
|---|---|
| `conference_room.created` | Room created |
| `conference_room.updated` | Room config changed |
| `conference_room.disabled` | Room disabled |
| `conference_room.deleted` | Room deleted |
| `conference.participant_joined` | Participant joined (if Go agent events enabled) |
| `conference.participant_left` | Participant left (if Go agent events enabled) |

---

## Approval Policy Integration

Conference room creation and update may require approval if the tenant policy
requires it. Approval gate follows the same `ApprovalRequest` pattern as IVR
publish.

---

## Testing Strategy

| Test type | Required |
|---|---|
| Unit — PIN hashing | PIN is never stored/returned in plaintext |
| Unit — room number uniqueness | Duplicate room number per tenant rejected |
| Unit — participant limits | max_participants enforced at dialplan generation |
| Integration — tenant isolation | Tenant A cannot list or modify Tenant B rooms |
| Integration — PIN update | PIN can be changed; old PIN hash is replaced |
| Integration — recording policy | Recording policy stored and projected correctly |
| Runtime smoke | Caller dials room number, enters PIN, joins conference |

---

## Runtime Evidence Required

Before production promotion:

- Live FreeSWITCH smoke: two callers join a conference room, conference connects.
- Moderator PIN proof: guest held in MoH until moderator joins.
- max_participants enforcement: join rejected when full.
- Evidence artifact tied to the RC commit.

---

## Release Stage Recommendation

| Stage | Recommendation |
|---|---|
| Public alpha | Not required |
| Public beta | Not a gate |
| Production | P1 for PBX completeness; requires implementation + runtime smoke |

---

## Open Questions

- Should recording policy `on_join` wait for recording subsystem evidence before
  being activatable in production?
- Should the API expose a list of active participants as a real-time feed (SSE)
  or only as a polled snapshot?
- Should moderator kick/mute participant actions be in scope for v1?
- Should conference rooms support time-based availability windows?
