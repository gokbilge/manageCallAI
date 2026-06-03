# PBX Completeness Layer — Data Model and API Proposal

Status: **Proposed design. Not implemented.**

This document consolidates the data model, API surface, authorization model,
audit events, and test plan for all six PBX completeness features. Each feature
has its own detailed design doc; this document serves as the cross-cutting
integration reference.

---

## 1. Proposed Tables

### 1.1 Feature codes

```sql
feature_codes (
  id, tenant_id, code, name, description,
  action_type, action_config JSONB,
  status, requires_approval,
  created_by, created_at, updated_at, published_at
)
-- Unique: (tenant_id, code)
```

### 1.2 Call parking

```sql
parking_lots (
  id, tenant_id, name,
  slot_range_start, slot_range_end, retrieve_prefix,
  timeout_seconds, timeout_target_type, timeout_target_id,
  music_on_hold, status, created_at, updated_at
)

parked_calls (
  id, tenant_id, parking_lot_id, slot_number, call_id,
  parked_by_extension_id, parked_at, timeout_at,
  retrieved_at, retrieved_by_extension_id, status
)
-- Unique: (tenant_id, parking_lot_id, slot_number) WHERE status = 'parked'
```

### 1.3 Conferencing

```sql
conference_rooms (
  id, tenant_id, room_number, name,
  pin_hash, moderator_pin_hash,
  max_participants, recording_policy,
  join_muted, announce_join_leave, music_on_hold, wait_for_moderator,
  status, created_by, created_at, updated_at
)
-- Unique: (tenant_id, room_number)

conference_participant_snapshots (
  id, tenant_id, conference_room_id, call_id,
  joined_at, left_at, is_moderator, status
)
-- Operational only, not desired state
```

### 1.4 Gateway reload / runtime apply

```sql
runtime_apply_requests (
  id, tenant_id, triggered_by_type, triggered_by_id,
  action_type, target_node_id, target_profile, target_gateway,
  object_type, object_id,
  status, requires_approval, approval_request_id,
  active_call_count, scheduled_at, applied_at,
  created_at, updated_at
)

runtime_apply_results (
  id, apply_request_id, node_id, action_type,
  status, response_payload JSONB, error_message, executed_at
)
```

### 1.5 End-user self-service

```sql
-- Extends extensions table:
-- dnd_enabled, call_forward_enabled, call_forward_target, voicemail_pin_hash

end_user_self_service_policies (
  id, tenant_id,
  voicemail_view, voicemail_listen, voicemail_pin_change,
  dnd_manage, call_forward_manage, call_forward_set_target,
  call_history_view, recording_view, device_view, sip_credential_reset,
  updated_at
)
-- Unique: tenant_id
```

### 1.6 Runtime management

```sql
runtime_operations (
  id, target_node_id, action_type, action_params JSONB,
  actor_type, actor_id, tenant_id,
  requires_approval, approval_request_id,
  status, result_payload JSONB, error_message,
  requested_at, executed_at, completed_at
)

runtime_operation_policy (
  id, action_type, requires_approval, approval_role,
  active_call_threshold, allowed_actor_roles TEXT[]
)
```

---

## 2. Relationships

```text
Tenant
  → feature_codes (one tenant, many codes)
  → parking_lots (one tenant, many lots)
  → parked_calls (one tenant, many parked calls)
  → conference_rooms (one tenant, many rooms)
  → conference_participant_snapshots (via conference_rooms)
  → runtime_apply_requests (tenant-scoped)
  → end_user_self_service_policies (one-to-one)

freeswitch_nodes (platform-level)
  → runtime_apply_requests (target_node_id)
  → runtime_apply_results (node_id)
  → runtime_operations (target_node_id)

approval_requests (existing)
  → runtime_apply_requests (approval_request_id)
  → runtime_operations (approval_request_id)
  → feature_codes (via object_type = 'feature_code')
  → conference_rooms (via object_type = 'conference_room')

audit_events (existing, append-only)
  ← all PBX layer mutations and runtime callbacks
```

---

## 3. Lifecycle States

### Feature code

```
draft → (validate) → active → disabled
```

- `draft`: created, not yet in FreeSWITCH dialplan.
- `active`: published, dialplan serves the code.
- `disabled`: deactivated, dialplan no longer serves the code.

### Parking lot

```
active → disabled
```

- No draft/publish cycle needed; parking lot config is operational config,
  not a versioned business object.

### Parked call

```
parked → retrieved
         timed_out
         abandoned
```

### Conference room

```
active → disabled
```

### RuntimeApplyRequest

```
pending → pending_approval → approved → applying → applied
                          ↘ rejected
       ↘ applying → applied
                  ↘ failed
       ↘ cancelled
```

### RuntimeOperation

```
pending → approved → executing → success
       ↘ rejected           ↘ failed
       ↘ cancelled
```

---

## 4. Endpoint List

### Feature codes

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/feature-codes` | List tenant's feature codes |
| POST | `/api/v1/feature-codes` | Create feature code |
| GET | `/api/v1/feature-codes/:id` | Get feature code |
| PATCH | `/api/v1/feature-codes/:id` | Update feature code |
| DELETE | `/api/v1/feature-codes/:id` | Delete feature code |
| POST | `/api/v1/feature-codes/:id/validate` | Validate code (collision check) |
| POST | `/api/v1/feature-codes/:id/publish` | Publish code |
| POST | `/api/v1/runtime/feature-code/execute` | Runtime callback (Lua) |

### Parking

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/parking-lots` | List parking lots |
| POST | `/api/v1/parking-lots` | Create parking lot |
| GET | `/api/v1/parking-lots/:id` | Get parking lot |
| PATCH | `/api/v1/parking-lots/:id` | Update parking lot |
| DELETE | `/api/v1/parking-lots/:id` | Delete parking lot |
| GET | `/api/v1/parking-lots/:id/parked-calls` | List active parked calls |
| GET | `/api/v1/parked-calls/:id` | Get parked call record |
| POST | `/api/v1/runtime/parking/park` | Runtime callback (Go agent) |
| POST | `/api/v1/runtime/parking/retrieve` | Runtime callback (Go agent) |
| POST | `/api/v1/runtime/parking/timeout` | Runtime callback (Go agent) |

### Conferencing

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/conference-rooms` | List conference rooms |
| POST | `/api/v1/conference-rooms` | Create conference room |
| GET | `/api/v1/conference-rooms/:id` | Get conference room |
| PATCH | `/api/v1/conference-rooms/:id` | Update conference room |
| DELETE | `/api/v1/conference-rooms/:id` | Delete conference room |
| GET | `/api/v1/conference-rooms/:id/participants` | Live participant snapshot |
| POST | `/api/v1/runtime/conference/joined` | Runtime callback (Go agent) |
| POST | `/api/v1/runtime/conference/left` | Runtime callback (Go agent) |

### Gateway reload

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/sip-trunks/:id/apply-requests` | Apply requests for a trunk |
| POST | `/api/v1/sip-trunks/:id/apply-now` | Trigger apply |
| GET | `/api/v1/runtime/apply-requests` | List apply requests |
| GET | `/api/v1/runtime/apply-requests/:id` | Get apply request |
| POST | `/api/v1/runtime/apply-requests/:id/result` | Runtime callback (Go agent) |
| GET | `/api/v1/platform/apply-requests` | Platform-admin view |

### End-user self-service

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/me/extension` | Own extension info |
| GET | `/api/v1/me/dnd` | Get DND state |
| PUT | `/api/v1/me/dnd` | Set DND state |
| GET | `/api/v1/me/call-forward` | Get call forward config |
| PUT | `/api/v1/me/call-forward` | Set call forward config |
| GET | `/api/v1/me/voicemail-messages` | List voicemail messages |
| GET | `/api/v1/me/voicemail-messages/:id` | Get voicemail message |
| PATCH | `/api/v1/me/voicemail-messages/:id` | Mark read/unread |
| POST | `/api/v1/me/voicemail-pin` | Change voicemail PIN |
| GET | `/api/v1/me/call-history` | Own call history |
| GET | `/api/v1/me/recordings` | Own recordings |
| GET | `/api/v1/me/recordings/:id` | Get recording metadata |
| GET | `/api/v1/me/devices` | SIP registration status |
| POST | `/api/v1/me/sip-credential/reset` | Reset SIP credential |
| GET | `/api/v1/tenant/self-service-policy` | Get self-service policy |
| PUT | `/api/v1/tenant/self-service-policy` | Update self-service policy |

### Runtime management

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/platform/nodes/:id/status` | Node status snapshot |
| GET | `/api/v1/platform/nodes/:id/modules` | Module status |
| GET | `/api/v1/platform/nodes/:id/gateways` | Gateway status |
| GET | `/api/v1/platform/nodes/:id/channels` | Active channels |
| GET | `/api/v1/platform/nodes/:id/registrations` | Active registrations |
| GET | `/api/v1/platform/runtime-operations` | List runtime operations |
| POST | `/api/v1/platform/runtime-operations` | Create runtime operation |
| GET | `/api/v1/platform/runtime-operations/:id` | Get runtime operation |
| DELETE | `/api/v1/platform/runtime-operations/:id` | Cancel pending operation |
| GET | `/api/v1/platform/runtime-operation-policy` | Get operation policy |
| PUT | `/api/v1/platform/runtime-operation-policy` | Update operation policy |
| GET | `/api/v1/runtime/gateway-status` | Tenant gateway status view |

---

## 5. Authorization Model

| Resource | `end_user` | `tenant_viewer` | `tenant_operator` | `tenant_admin` | `platform_admin` |
|---|---|---|---|---|---|
| Feature codes (read) | ✗ | ✓ | ✓ | ✓ | ✓ |
| Feature codes (write) | ✗ | ✗ | ✓ | ✓ | ✓ |
| Feature codes (publish) | ✗ | ✗ | ✗ | ✓ | ✓ |
| Parking lots (read) | ✗ | ✓ | ✓ | ✓ | ✓ |
| Parking lots (write) | ✗ | ✗ | ✗ | ✓ | ✓ |
| Parked calls (read) | ✗ | ✓ | ✓ | ✓ | ✓ |
| Conference rooms (read) | ✗ | ✓ | ✓ | ✓ | ✓ |
| Conference rooms (write) | ✗ | ✗ | ✗ | ✓ | ✓ |
| Apply requests (read) | ✗ | ✓ | ✓ | ✓ | ✓ |
| Apply now | ✗ | ✗ | ✗ | ✓ | ✓ |
| Self-service policy (read) | ✗ | ✗ | ✗ | ✓ | ✓ |
| Self-service policy (write) | ✗ | ✗ | ✗ | ✓ | ✓ |
| `/me/*` endpoints | ✓ | ✓ | ✓ | ✓ | ✓ |
| Node status (platform) | ✗ | ✗ | ✗ | ✗ | ✓ |
| Runtime operations | ✗ | ✗ | ✗ | ✗ | ✓ |
| Gateway status (own) | ✗ | ✗ | ✓ | ✓ | ✓ |

Runtime callbacks (from Go agent or Lua) use HMAC node authentication — not JWT.

---

## 6. Audit Events Summary

| Domain | Event |
|---|---|
| Feature code | created, updated, validated, published, disabled, deleted, executed |
| Parking | parking_lot.created/updated/disabled, call.parked/retrieved/timed_out/abandoned |
| Conferencing | conference_room.created/updated/disabled/deleted, participant.joined/left |
| Gateway reload | trunk.updated, apply_requested/approved/rejected/applying/applied/failed/cancelled |
| Self-service | extension.dnd_changed, extension.call_forward_changed, voicemail.pin_changed, extension.sip_credential_reset, self_service_policy.updated |
| Runtime management | operation_requested/approved/rejected/executing/success/failed/cancelled, runtime.module_missing |

---

## 7. Runtime Callbacks (Summary)

| Endpoint | Called by | Auth |
|---|---|---|
| `POST /runtime/feature-code/execute` | Lua executor | HMAC node |
| `POST /runtime/parking/park` | Go agent | HMAC node |
| `POST /runtime/parking/retrieve` | Go agent | HMAC node |
| `POST /runtime/parking/timeout` | Go agent | HMAC node |
| `POST /runtime/conference/joined` | Go agent | HMAC node |
| `POST /runtime/conference/left` | Go agent | HMAC node |
| `POST /runtime/apply-requests/:id/result` | Go agent | HMAC node |

All runtime callbacks require `x-managecallai-node-id` + HMAC signature headers.
No JWT is accepted on runtime callback endpoints.

---

## 8. OpenAPI / Contract Implications

Each new feature requires:

1. Zod schemas added to `packages/contracts`.
2. OpenAPI paths added — `pnpm generate:openapi` must regenerate without drift.
3. SDK types regenerated (`packages/sdk`).
4. CI drift check must continue to pass.
5. MCP tool schemas updated if any new read-only tools are added.
6. API key capability matrix updated if new capabilities are needed.
7. Webhook payload check updated if new event types are added.

---

## 9. Migration Plan

Migrations are added in sequence after existing migrations. Each migration should:

1. Be additive — new tables and columns only.
2. Not modify existing tables destructively.
3. Be accompanied by a `db:contracts` update.
4. Be tested with `pnpm db:migrate && pnpm db:contracts && pnpm db:constraints`.

Suggested migration order:

| Migration | Scope |
|---|---|
| `0050_feature_codes.sql` | `feature_codes` table |
| `0051_parking.sql` | `parking_lots`, `parked_calls` |
| `0052_conference_rooms.sql` | `conference_rooms`, `conference_participant_snapshots` |
| `0053_runtime_apply.sql` | `runtime_apply_requests`, `runtime_apply_results` |
| `0054_self_service_policy.sql` | `end_user_self_service_policies` + extension columns |
| `0055_runtime_operations.sql` | `runtime_operations`, `runtime_operation_policy` |

Do not add these migrations until implementation work begins. Adding empty
migrations before code is a maintenance burden.

---

## 10. Test Plan

### Unit tests (service layer)

- Feature code: collision detection, emergency number check, action type resolution.
- Parking: slot availability, timeout calculation, tenant isolation.
- Conference: PIN hashing, room number uniqueness, recording policy.
- Gateway reload: allowlist enforcement, active call count gate.
- Self-service: role gating, policy gating, self-ownership enforcement.
- Runtime ops: allowlist enforcement, approval gate.

### Integration tests

- Tenant isolation matrix for every new resource type.
- Lifecycle state transitions (create → publish / active → disabled).
- Runtime callback endpoints (Lua/Go agent mock, HMAC signature validation).
- Audit event creation for every mutation.

### Runtime smoke tests

- Feature code executed via real FreeSWITCH DTMF input.
- Call parked and retrieved via real FreeSWITCH valet_park.
- Conference room joined by two callers.
- Gateway reload triggered after trunk change: REGED confirmed.
- Evidence artifact tied to RC commit.

---

## 11. Implementation Recommendation Order

Given priorities:

1. **Gateway reload on trunk change (P0)** — most urgent; enables trunk management
   without CLI. Extends existing sip_trunks and freeswitch_nodes modules.
2. **Feature codes (P1)** — foundation for parking, DND, forward from a phone.
3. **Call parking (P1)** — depends on feature codes for `*park` / `*retrieve` codes.
4. **Conferencing (P1)** — independent; uses mod_conference.
5. **Runtime management read-only (P1)** — dashboard visibility; Go agent status endpoint.
6. **Self-service portal (P2)** — end-user-facing; depends on feature codes for DND/forward.
7. **Runtime management controlled actions (P2)** — higher risk; requires approval gating.

---

The PBX Completeness Layer is **designed and planned** as of this document. None
of these features are implemented. Do not claim them as production-ready until
implementation, tests, tenant isolation coverage, and runtime evidence are present.
