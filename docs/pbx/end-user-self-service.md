# End-User Self-Service Portal — Design

Status: **Implemented in the current admin app for the v0.5 self-service slice.**

Implemented:

- `end_user` tenant role in the database/API role model.
- Tenant-level self-service policy for DND, call forwarding, voicemail-view,
  voicemail-PIN-change, call-history-view, device-view, and SIP-reset
  capability flags.
- Extension owner linkage via `extensions.owner_user_id`.
- `/api/v1/me/extension`, `/api/v1/me/dnd`, and `/api/v1/me/call-forward`.
- `/api/v1/me/voicemail-messages`, playback, mark-read, and delete.
- `/api/v1/me/call-history`.
- `/api/v1/me/devices`.
- `/api/v1/me/sip-credential/reset`.
- `/api/v1/tenant/self-service-policy` for tenant admins.
- End-user route in the existing React app at `/tenant/me`.

Still deferred:

- `/me/voicemail-pin`.
- `/me/recordings`.
- Runtime evidence that DND/forward changes are consumed by live FreeSWITCH.
Priority: P1/P2 follow-up hardening. The core end-user surface is now present in
the shipped product line, but runtime evidence and voicemail-PIN flows remain
incomplete.

---

## Goal

Provide an end-user surface where extension owners can self-manage their own
settings without access to tenant admin or operator capabilities.

Current implementation uses a protected route in the existing React app
(`'/tenant/me'`) instead of a separate standalone portal.

---

## User Stories

- As an employee, I want to check my voicemail messages and listen to them from
  the browser without asking IT.
- As an employee, I want to enable or disable Do Not Disturb from my phone or the
  web portal without calling the helpdesk.
- As an employee, I want to set my call forwarding number so incoming calls are
  routed to my mobile when I am out of the office.
- As an employee, I want to see my own call history.
- As an employee, I want to change my voicemail PIN.
- As a tenant admin, I want to control which self-service features each employee
  can access.
- As a tenant admin, I want to disable call forwarding self-service entirely so
  employees cannot forward calls outside the company.

---

## Non-Goals

- No trunk management.
- No IVR flow publish, validate, simulate, rollback.
- No FreeSWITCH module/runtime actions.
- No tenant routing configuration changes.
- No platform admin access.
- No SIP credentials shown after creation (password is write-only).
- No admin features available through the end-user portal.

---

## RBAC

### New role: `end_user`

The `end_user` role is a new tenant role below `tenant_viewer`.

| Role | DB storage | Notes |
|---|---|---|
| `tenant_admin` | `users.role` | Full tenant management |
| `tenant_operator` | `users.role` | Routing and flow management |
| `tenant_viewer` | `users.role` | Read-only admin view |
| `end_user` | `users.role` | Self-service only — cannot see admin resources |

The `end_user` role must be added to the capability matrix in `packages/contracts`
and enforced in the `require-capability` middleware.

### Capability gating for self-service

All end-user self-service capabilities are gated by a tenant-level policy. Tenant
admin can enable or disable each feature per tenant:

| Self-service capability | Tenant policy flag | Default |
|---|---|---|
| View own voicemail | `self_service.voicemail_view` | enabled |
| Listen to voicemail | `self_service.voicemail_listen` | enabled |
| Change voicemail PIN | `self_service.voicemail_pin_change` | enabled |
| Enable/disable DND | `self_service.dnd_manage` | enabled |
| Enable/disable call forward | `self_service.call_forward_manage` | disabled |
| Set call forward target | `self_service.call_forward_set_target` | disabled |
| View own call history | `self_service.call_history_view` | enabled |
| View own recordings | `self_service.recording_view` | disabled |
| View own SIP registration status | `self_service.device_view` | enabled |
| Reset own SIP credential | `self_service.sip_credential_reset` | disabled |

---

## Domain Model

### EndUserSelfServicePolicy (extends tenant policy)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → tenants (unique) |
| `voicemail_view` | bool | |
| `voicemail_listen` | bool | |
| `voicemail_pin_change` | bool | |
| `dnd_manage` | bool | |
| `call_forward_manage` | bool | |
| `call_forward_set_target` | bool | |
| `call_history_view` | bool | |
| `recording_view` | bool | |
| `device_view` | bool | |
| `sip_credential_reset` | bool | |
| `updated_at` | timestamptz | |

### Extension self-service state (extends extensions table)

These fields may already exist or need to be added:

| Field | Notes |
|---|---|
| `dnd_enabled` | Boolean — Do Not Disturb flag |
| `call_forward_enabled` | Boolean |
| `call_forward_target` | Text — E.164 or extension number |
| `voicemail_pin_hash` | Bcrypt hash of voicemail PIN |

---

## API Design

All end-user endpoints are scoped to `self` — the authenticated user's own
extension. Users cannot specify other user or extension IDs.

```
# Extension self-view
GET    /api/v1/me/extension

# DND
GET    /api/v1/me/dnd
PUT    /api/v1/me/dnd

# Call forwarding
GET    /api/v1/me/call-forward
PUT    /api/v1/me/call-forward

# Voicemail
GET    /api/v1/me/voicemail-messages
GET    /api/v1/me/voicemail-messages/:id
PATCH  /api/v1/me/voicemail-messages/:id   (mark read/unread)
POST   /api/v1/me/voicemail-pin            (change PIN)

# Call history (own only)
GET    /api/v1/me/call-history

# Recordings (own calls, if tenant policy allows)
GET    /api/v1/me/recordings
GET    /api/v1/me/recordings/:id

# Devices / SIP registration
GET    /api/v1/me/devices

# SIP credential reset (if tenant policy allows)
POST   /api/v1/me/sip-credential/reset

# Tenant self-service policy (tenant admin only — manage what end users can do)
GET    /api/v1/tenant/self-service-policy
PUT    /api/v1/tenant/self-service-policy
```

### Request Examples

**Enable DND:**
```json
PUT /api/v1/me/dnd
{ "enabled": true }
```

**Set call forward:**
```json
PUT /api/v1/me/call-forward
{
  "enabled": true,
  "target": "+12125551234"
}
```

**Change voicemail PIN:**
```json
POST /api/v1/me/voicemail-pin
{
  "current_pin": "1234",
  "new_pin": "5678"
}
```

### Authorization rules

- All `/api/v1/me/*` endpoints require a JWT with role `end_user` or higher.
- The `user_id` in the JWT is the implicit scope — no override is accepted.
- Each capability is additionally gated by the `EndUserSelfServicePolicy` for
  the user's tenant.
- If a capability is disabled in the tenant policy, the endpoint returns 403 with
  a clear error code (not 404).

---

## Database Design

```sql
-- Extend extensions table (or add separate table if schema migration is preferred)
ALTER TABLE extensions ADD COLUMN dnd_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE extensions ADD COLUMN call_forward_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE extensions ADD COLUMN call_forward_target TEXT;
ALTER TABLE extensions ADD COLUMN voicemail_pin_hash TEXT;

-- Self-service policy per tenant
CREATE TABLE end_user_self_service_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
  voicemail_view BOOLEAN NOT NULL DEFAULT TRUE,
  voicemail_listen BOOLEAN NOT NULL DEFAULT TRUE,
  voicemail_pin_change BOOLEAN NOT NULL DEFAULT TRUE,
  dnd_manage BOOLEAN NOT NULL DEFAULT TRUE,
  call_forward_manage BOOLEAN NOT NULL DEFAULT FALSE,
  call_forward_set_target BOOLEAN NOT NULL DEFAULT FALSE,
  call_history_view BOOLEAN NOT NULL DEFAULT TRUE,
  recording_view BOOLEAN NOT NULL DEFAULT FALSE,
  device_view BOOLEAN NOT NULL DEFAULT TRUE,
  sip_credential_reset BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## FreeSWITCH Integration

DND and call forward changes update the extension's desired state in PostgreSQL.
FreeSWITCH picks up the changes via `mod_xml_curl` at the next directory request
or when the extension re-registers.

For active calls, a feature code (see `feature-codes.md`) can trigger DND/forward
changes in real time without waiting for the next registration.

---

## UI/UX Design

### Portal layout

Separate from the admin UI. Accessible at `/portal` or a subdomain.

- Simplified navigation: My Profile, Voicemail, Call History, Settings.
- No admin navigation items.
- Clear "tenant-controlled" labels for disabled features.

### Profile / extension page

- Extension number (read-only).
- Display name.
- SIP registration status indicator (online / offline).
- DND toggle.
- Call forward toggle + target number input.

### Voicemail page

- Voicemail message list: caller, date, duration, read/unread.
- Play button (in-browser audio, if tenant policy allows).
- Download button (if tenant policy allows).
- Mark read/unread.
- Delete (with confirmation).
- Change PIN button (if tenant policy allows).

### Call history page

- Own call history: date, direction, counterpart, duration, disposition.
- Filter: inbound/outbound, date range.

### Recordings page

- Only visible if tenant policy allows.
- Own recordings from calls.
- Play / download within tenant policy rules.

### Settings page

- Change voicemail PIN.
- Call forwarding config.
- DND schedule (future).

### Permission-denied states

When a self-service feature is disabled by tenant policy:

- Feature section is shown grayed out with message: "This feature is disabled by
  your organization. Contact your administrator."
- 403 response from API includes `error.code = 'SELF_SERVICE_CAPABILITY_DISABLED'`.

---

## MCP/n8n Exposure

End-user self-service is not exposed via MCP or n8n. These surfaces target
tenant operators, not end users.

The tenant admin can trigger DND or forward changes via MCP on behalf of users
through the standard extension management tools, subject to existing capability
gates.

---

## Security and Tenant Isolation

- JWT `sub` claim is the only identity for `/api/v1/me/*` — no user ID override.
- All queries join through `users.tenant_id` to ensure cross-tenant isolation.
- Voicemail PIN change requires the current PIN before accepting a new one.
- Voicemail PIN is hashed (bcrypt) before storage.
- SIP credential reset generates a new random password and returns it once — it
  is never stored in plaintext and never re-shown.
- Call history and recordings are filtered to the authenticated user's extension.
- Tenant policy gates are checked in the service layer, not only in middleware.
- End users cannot escalate to operator or admin roles.

---

## Audit Events

| Event | Trigger |
|---|---|
| `extension.dnd_changed` | DND enabled or disabled by end user |
| `extension.call_forward_changed` | Call forward changed by end user |
| `voicemail.pin_changed` | Voicemail PIN changed |
| `extension.sip_credential_reset` | SIP credential reset by end user |
| `self_service_policy.updated` | Tenant admin changes self-service policy |

---

## Approval Policy Integration

End-user self-service changes (DND, call forward) do not require approval by
default. The tenant admin can enable approval requirements for call forward changes
if the organization's policies require it.

---

## Testing Strategy

| Test type | Required |
|---|---|
| Unit — role gating | `end_user` cannot access admin endpoints |
| Unit — self-ownership | `/me/*` endpoints reject any attempt to access other users |
| Unit — policy gating | Disabled capability returns 403 with correct error code |
| Integration — cross-tenant | User from Tenant A cannot access Tenant B `/me/*` resources |
| Integration — voicemail PIN | PIN change requires correct current PIN |
| Integration — SIP credential reset | Reset returns new credential once, subsequent reads show nothing |
| Integration — tenant policy update | Disabling a capability takes effect immediately |
| Unit — sensitive data | Voicemail PIN hash is never returned in API responses |

---

## Release Stage Recommendation

| Stage | Recommendation |
|---|---|
| Public alpha | Not required |
| Public beta | Not a gate |
| Production | P2 — implement when PBX completeness layer is otherwise complete |

---

## Open Questions

- Should the end-user portal be a separate React app or a protected route
  segment in the existing admin React app?
- Should DND activate immediately via a FreeSWITCH channel variable or only at
  next registration?
- Should call forward changes be propagated to FreeSWITCH via a feature code
  invocation or only via directory re-read?
- Should users be able to view voicemail from other extensions that they are
  explicitly authorized to cover (assistant feature)?
- Should DND scheduling (auto-off at 8am) be in scope for v1?
