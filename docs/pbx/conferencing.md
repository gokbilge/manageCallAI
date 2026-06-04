# Native Conferencing

Status: **Implemented in API/runtime; tenant admin UI available.**
Priority: P1 for PBX completeness. Production still requires live
`mod_conference` runtime evidence tied to the release candidate commit.

## Current implementation

`manageCallAI` manages conference rooms as tenant-scoped desired state in
PostgreSQL. FreeSWITCH stays runtime-only and executes the actual conference
bridge through `mod_conference`.

Implemented today:

- conference-room CRUD in the API
- room status transitions: `active` / `disabled`
- encrypted optional PIN storage
- participant snapshot callbacks from the Go runtime path
- dialplan and `conference.conf` projection through the FreeSWITCH integration
- tenant workspace UI at `/tenant/conference-rooms`

Not implemented today:

- moderator PIN / guest PIN split
- moderator controls such as kick, mute, or lock
- approval-gated conference lifecycle
- browser/WebRTC conferencing

## API surface

Tenant-authenticated endpoints:

```text
GET    /api/v1/conference-rooms
POST   /api/v1/conference-rooms
GET    /api/v1/conference-rooms/:id
PATCH  /api/v1/conference-rooms/:id
POST   /api/v1/conference-rooms/:id/disable
POST   /api/v1/conference-rooms/:id/enable
DELETE /api/v1/conference-rooms/:id
GET    /api/v1/conference-rooms/:id/participants
```

Runtime-authenticated callbacks:

```text
POST   /api/v1/runtime/conference/joined
POST   /api/v1/runtime/conference/left
```

## Authorization model

Current capability model:

| Action | Capability |
|---|---|
| list/read/participants | `tenant.conference_rooms.view` |
| create | `tenant.conference_rooms.create` |
| update / enable | `tenant.conference_rooms.update` |
| disable / delete | `tenant.conference_rooms.deactivate` |

Role behavior:

- `tenant_viewer`: view-only
- `tenant_operator`: can create and update
- `tenant_admin`: full lifecycle including disable/delete
- runtime callbacks: runtime auth only

## Data model

Current public room shape:

| Field | Notes |
|---|---|
| `id` | UUID |
| `tenant_id` | tenant owner |
| `name` | human label |
| `room_number` | numeric dialable extension |
| `has_pin` | boolean only, never returns plaintext PIN |
| `max_participants` | integer limit |
| `record_calls` | recording toggle |
| `status` | `active` or `disabled` |
| `created_by` | actor UUID if present |
| `created_at` / `updated_at` | timestamps |

Participant snapshot shape:

| Field | Notes |
|---|---|
| `id` | UUID |
| `tenant_id` | tenant owner |
| `conference_room_id` | room FK |
| `call_id` | FreeSWITCH call UUID |
| `joined_at` | observed join time |
| `left_at` | null while still joined |

## UI surface

Tenant admins and operators manage rooms from:

```text
/tenant/conference-rooms
```

Current UI covers:

- room inventory list
- create/edit form
- PIN posture display
- max participant and recording settings
- enable/disable/delete actions according to capability
- active participant snapshot panel
- empty/error/read-only states

## Runtime boundary

- API owns desired state, tenant scoping, auth, and audit
- FreeSWITCH runs the conference bridge
- Go agent/runtime callbacks update participant snapshots
- no raw `conference` ESL control is exposed through REST, MCP, or n8n

## Evidence posture

Implemented code and UI are not production evidence.

Before production promotion, collect real artifacts for:

- two-caller `mod_conference` smoke
- PIN enforcement
- participant callback visibility
- any recording behavior you intend to operate in production

Those artifacts must be tied to the RC or release commit.
