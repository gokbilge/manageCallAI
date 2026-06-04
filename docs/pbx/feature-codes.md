# Feature Codes — Design

Status: **Implemented in API/runtime and productized in the tenant admin web UI.**
Priority: P0/P1 — `v0.4.x` competitive baseline and early production PBX completeness.

---

## Goal

Enable tenant administrators to define and publish DTMF feature codes that let
on-net callers invoke PBX services (voicemail access, call forward, DND, parking,
conference join, call pickup) without hardcoding them in FreeSWITCH XML dialplans
or Lua scripts.

---

## User Stories

- As a tenant admin, I want to define `*72` as "enable call forward" so my users
  can activate forwarding from any phone.
- As a tenant admin, I want to define `*71` as "retrieve parked call" so my
  receptionists can retrieve calls by code.
- As a tenant admin, I want to change `*98` to `*97` for voicemail access without
  touching FreeSWITCH XML.
- As an operator, I want to validate, publish, disable, and review lifecycle state for a feature code from the web UI.
- As an auditor, I want to see who created or changed a feature code and when.
- As an AI agent (via MCP), I want to list configured feature codes for a tenant.

---

## Non-Goals

- Feature codes do not replace the IVR flow designer for complex call flows.
- Feature codes do not expose raw ESL command execution to callers.
- Feature codes do not allow callers to trigger arbitrary Lua or shell commands.
- MCP/n8n do not expose a publish action — that remains operator-only.

---

## Domain Model

### FeatureCode

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → tenants |
| `code` | text | DTMF code, e.g. `*72` |
| `name` | text | Human label, e.g. "Enable Call Forward" |
| `description` | text | Optional operator description |
| `action_type` | enum | See action types below |
| `action_config` | jsonb | Action-specific config |
| `status` | enum | `draft` / `active` / `disabled` |
| `requires_approval` | bool | Whether publish needs approval |
| `created_by` | UUID | FK → users |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `published_at` | timestamptz | Null until published |

### Action Types

| Action type | Description |
|---|---|
| `voicemail_access` | Route caller to their voicemail box |
| `call_forward_enable` | Enable call forwarding to a target |
| `call_forward_disable` | Disable call forwarding |
| `dnd_enable` | Enable Do Not Disturb |
| `dnd_disable` | Disable Do Not Disturb |
| `call_pickup` | Pick up ringing call in a group |
| `call_park` | Park the current call |
| `call_park_retrieve` | Retrieve a parked call by slot |
| `conference_join` | Join a conference room |
The current code line does not implement a dedicated `FeatureCodePublishRecord`
table. Publish and runtime activity are captured through status fields plus audit
events.

---

## API Design

All endpoints are tenant-scoped. `tenant_id` is derived from the JWT, not the URL.

### Endpoints

```
GET    /api/v1/feature-codes
POST   /api/v1/feature-codes
GET    /api/v1/feature-codes/:id
PATCH  /api/v1/feature-codes/:id
DELETE /api/v1/feature-codes/:id

POST   /api/v1/feature-codes/:id/validate
POST   /api/v1/feature-codes/:id/publish
POST   /api/v1/feature-codes/:id/disable

# Runtime callback (FreeSWITCH → API, runtime-auth only)
POST   /api/v1/feature-codes/runtime/execute
```

### Request Examples

**Create:**
```json
POST /api/v1/feature-codes
{
  "code": "*72",
  "name": "Enable Call Forward",
  "action_type": "call_forward_enable",
  "action_config": { "prompt": "Enter forward-to number followed by #" },
  "requires_approval": false
}
```

**Runtime callback (from Lua via runtime-auth):**
```json
POST /api/v1/feature-codes/runtime/execute
{
  "node_id": "fs-node-1",
  "call_id": "abc123",
  "caller_extension_id": "ext-uuid",
  "dtmf_code": "*72",
  "dtmf_input": "2125551234"
}
```

Response:
```json
{
  "action": "play_prompt",
  "prompt": "forward_enabled.wav"
}
```

### Authorization

| Action | Required role |
|---|---|
| List/read | `tenant.feature_codes.view` (`tenant_viewer` or higher) |
| Create | `tenant.feature_codes.create` (`tenant_operator` or higher) |
| Update draft | `tenant.feature_codes.update` (`tenant_operator` or higher) |
| Validate draft | `tenant.feature_codes.validate` (`tenant_operator` or higher) |
| Publish draft | `tenant.feature_codes.publish` (`tenant_admin`) |
| Disable/delete | `tenant.feature_codes.deactivate` (`tenant_admin`) |
| Runtime execute | Runtime HMAC node auth only |

### Tenant admin web surface

The tenant workspace now includes a dedicated **Feature Codes** page that
provides:

- inventory and status visibility for all tenant-scoped feature codes
- draft create/edit flow
- validation feedback with surfaced API errors
- publish, disable, and delete actions based on role capability
- emergency-number safety messaging and immutable-state guidance

---

## Database Design

```sql
CREATE TABLE feature_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  action_type TEXT NOT NULL,
  action_config JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'disabled')),
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  UNIQUE (tenant_id, code)
);

CREATE INDEX ON feature_codes (tenant_id);
```

The `UNIQUE (tenant_id, code)` constraint prevents two active codes colliding
within the same tenant. Conflict with extension number ranges or emergency numbers
is validated at the service layer (not only DB).

---

## FreeSWITCH Integration

### Dialplan generation

On publish, the API generates a dialplan context section for the tenant that
routes `^(\*\d+)$` patterns to a Lua executor:

```xml
<extension name="feature_codes">
  <condition field="destination_number" expression="^(\*\d+)$">
    <action application="lua" data="feature_code_handler.lua ${destination_number}"/>
  </condition>
</extension>
```

This section is served via `mod_xml_curl` from the existing
`/api/v1/freeswitch/dialplan` endpoint — no separate endpoint is needed.

### Lua thin executor

`feature_code_handler.lua` is a new thin executor (alongside the existing IVR
helper). It:

1. Reads `${destination_number}` (the dialed code).
2. Reads `${caller_extension_id}` from channel variables.
3. POSTs to `/api/v1/feature-codes/runtime/execute` with runtime-auth.
4. Executes the returned bounded action (play_prompt, collect_digits, transfer,
   hangup, set_variable).
5. Reports result back.

No business logic lives in Lua.

### Runtime resolution

The API `/api/v1/feature-codes/runtime/execute` endpoint:

1. Authenticates the caller via node HMAC.
2. Resolves `dtmf_code` against `feature_codes` for the tenant.
3. Verifies the feature code is `active`.
4. Authorizes the calling extension to use the code.
5. Applies the action logic (e.g., writes `call_forwarding` to extension state,
   writes DND flag, routes to parking).
6. Returns a bounded action instruction for Lua.
7. Writes an audit event.

---

## Runtime Behavior

| Action type | Lua behavior | API side effect |
|---|---|---|
| `voicemail_access` | Transfer to voicemail dialplan target | None (read-only routing) |
| `call_forward_enable` | Collect digits, play confirm prompt | Write forward target to extension record |
| `call_forward_disable` | Play confirm prompt | Clear forward target from extension record |
| `dnd_enable` | Play confirm prompt | Set DND flag on extension |
| `dnd_disable` | Play confirm prompt | Clear DND flag on extension |
| `call_pickup` | Transfer to ringing target | None (routing only) |
| `call_park` | Park call in parking lot | Write parked_calls record |
| `call_park_retrieve` | Transfer to parked slot | Clear parked_calls record |
| `conference_join` | Transfer to conference room entry point | None (routing only) |

---

## UI/UX Design

### Feature code list

- Table: code, name, action type, status, last published date.
- Badge: draft / active / disabled.
- Actions: edit, validate, publish, disable, delete.

### Create / edit form

- Code field with validation (format, uniqueness within tenant).
- Action type selector.
- Action-specific config fields rendered dynamically.
- Approval requirement toggle (visible to tenant admins).

### Conflict detection

Before save: inline check for collision with:
- other feature codes in the same tenant
- extension number ranges
- emergency number prefixes (e.g., `112`, `911`, `999`)
- outbound route prefix overlaps

### Validation preview

Shows which dialplan context section the code will generate and any conflict
warnings before publish.

### Published dialplan preview

Shows the XML fragment that will be served to FreeSWITCH.

### Publish status

Active badge + timestamp. If pending approval, shows approval request state.

### Audit trail

Per-code audit log: who created, validated, published, disabled, deleted.

---

## MCP/n8n Exposure

| Tool / event | Allowed | Notes |
|---|---|---|
| `list_feature_codes` | Yes | Read-only |
| `get_feature_code` | Yes | Read-only |
| Publish via MCP | No | Publish is operator-only |
| n8n webhook: `feature_code.published` | Yes | Informational event |
| n8n webhook: `feature_code.created` | Yes | Informational event |

MCP tools operate on draft reads only; publish is not exposed.

---

## Security and Tenant Isolation

- All DB queries include `WHERE tenant_id = $tenantId`.
- Feature code execution endpoint is runtime-HMAC only — no JWT, no MCP.
- Code collision with emergency numbers is checked before save and before publish.
- Lua executor only calls back to the API; it does not look up FreeSWITCH state
  directly or read DB directly.
- Cross-tenant feature code lookup is impossible at the code level.

---

## Audit Events

| Event | Trigger |
|---|---|
| `feature_code.created` | Feature code created |
| `feature_code.updated` | Feature code edited |
| `feature_code.validated` | Validation run completed |
| `feature_code.published` | Feature code published (status → active) |
| `feature_code.disabled` | Feature code disabled |
| `feature_code.deleted` | Feature code deleted |
| `feature_code.executed` | Feature code invoked at runtime |

---

## Approval Policy Integration

If `requires_approval = true`:

1. Publish request creates an `ApprovalRequest` with `object_type = 'feature_code'`.
2. The feature code remains in `draft` status until the approval resolves.
3. Approval resolved → automatic publish; rejected → stays draft.
4. Audit event records both the publish request and the approval decision.

---

## Testing Strategy

| Test type | Required |
|---|---|
| Unit — service layer | Duplicate code prevention per tenant, action type resolution |
| Unit — code validation | Emergency number collision, extension range collision |
| Integration — tenant isolation | Tenant A cannot read or modify Tenant B codes |
| Integration — lifecycle | draft → validate → publish → disabled |
| Integration — runtime callback | Code lookup by tenant, unauthorized extension rejection |
| Integration — audit | Every mutation writes an audit event |
| Runtime smoke | Dialplan serves feature code context; Lua executes callback; action applied |

---

## Runtime Evidence Required

Before production promotion:

- Smoke test: DTMF code dialed on real FreeSWITCH → Lua executor → API callback
  → action applied → audit event written.
- Evidence artifact tied to the RC commit.

---

## Release Stage Recommendation

| Stage | Recommendation |
|---|---|
| Public beta | Designed, not implemented — not a beta gate |
| Production | P1 for PBX completeness; requires implementation, tests, and runtime smoke evidence |

---

## Open Questions

- Should feature codes support time-of-day restrictions (e.g., DND auto-off at
  8am)?
- Should custom_safe_action be a v2 concern?
- Should call_pickup specify a pickup group, or always use the extension's assigned
  group?
- Do per-extension feature code overrides need to be supported?
