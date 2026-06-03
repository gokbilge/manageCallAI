# FreeSWITCH Runtime Management — Design

Status: **Designed, not implemented.**
Priority: Read-only status P1. Controlled actions P1/P2. Arbitrary management: out of scope.

---

## Goal

Provide a safe operations layer for FreeSWITCH module and runtime state visibility,
with a controlled allowlist of administrative actions that do not require direct
CLI access to the FreeSWITCH console.

The starting point is **read-only visibility**. Controlled actions come later and
require approval gating and audit.

---

## User Stories

- As a platform operator, I want to see which modules are loaded on each
  FreeSWITCH node without SSH access.
- As a platform operator, I want to see which required modules are missing and
  get an alert if a required module is not loaded.
- As a platform operator, I want to see active call channel count per node.
- As a tenant admin, I want to see whether my SIP trunks' gateways are in REGED
  state.
- As a platform operator, I want to trigger `reloadxml` or `sofia profile rescan`
  from the UI without opening a FreeSWITCH CLI session.
- As a platform operator, I want any runtime action to require approval before
  it is executed.
- As an auditor, I want to see every runtime action request, who triggered it,
  and what the result was.

---

## Non-Goals

- No arbitrary `api` or `bgapi` command passthrough.
- No arbitrary module load/unload — only from an explicit allowlist.
- No raw Lua script execution via the API.
- No shell command access to the host OS.
- No unrestricted `sofia` command surface.

---

## Read-Only Visibility (Phase 1)

### Capabilities

| Capability | FreeSWITCH API command | Notes |
|---|---|---|
| List loaded modules | `api show modules` | Required module check |
| Show FreeSWITCH version | `api version` | Node version audit |
| Show Sofia profile status | `api sofia status` | All profiles and gateways |
| Show gateway status | `api sofia status gateway <name>` | Per-gateway state |
| Show active channels | `api show channels as json` | Live call count |
| Show registrations | `api show registrations as json` | Active SIP registrations |
| Show conference status | `api conference list` | If mod_conference enabled |
| Show active parks | `api valet_info` | If valet_park enabled |

### Domain Model: FreeSWITCHNodeStatus

| Field | Type | Notes |
|---|---|---|
| `node_id` | UUID | FK → freeswitch_nodes |
| `queried_at` | timestamptz | When this snapshot was taken |
| `version` | text | FreeSWITCH version string |
| `loaded_modules` | text[] | List of loaded module names |
| `missing_required_modules` | text[] | Required minus loaded |
| `sofia_profiles` | jsonb | Profile status map |
| `gateway_statuses` | jsonb | Per-gateway state |
| `active_channel_count` | int | Current active calls |
| `active_registration_count` | int | Current SIP registrations |

This is a polled/cached snapshot, not a persisted audit record.

### Required module list

Platform admin configures the required module list per node type:

```
mod_sofia
mod_conference
mod_dptools
mod_event_socket
mod_xml_curl
mod_lua
mod_valet_parking  (if parking is used)
```

A missing required module triggers a health alert.

---

## Controlled Actions (Phase 2)

### Allowlisted safe actions

| Action type | FreeSWITCH command | Risk level |
|---|---|---|
| `reloadxml` | `api reloadxml` | Low — no active call disruption |
| `reloadacl` | `api reloadacl` | Low |
| `sofia_profile_rescan` | `api sofia profile <profile> rescan` | Low — no call drop |
| `sofia_profile_restart` | `api sofia profile <profile> restart` | High — drops calls on profile |
| `sofia_profile_killgw` | `api sofia profile <profile> killgw <gw>` | Medium |
| `sofia_profile_restartgw` | `api sofia profile <profile> restartgw <gw>` | Medium |
| `reload_module_allowlisted` | `api reload <module>` (from allowlist only) | High — requires approval |

Never allowed:
- `api load <module>` (arbitrary load)
- `api unload <module>` (arbitrary unload)
- `api fsctl shutdown`
- `api exec` or shell commands

### Module reload allowlist

Only explicitly allowed modules may be reloaded:

```
mod_conference
mod_valet_parking
mod_xml_curl
mod_sofia
```

Any request to reload a module not on this list is rejected at the service layer.

---

## Domain Model: RuntimeOperation

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `target_node_id` | UUID | FK → freeswitch_nodes |
| `action_type` | text | From allowlist enum |
| `action_params` | jsonb | Profile name, gateway name, module name |
| `actor_type` | text | `user` / `system` |
| `actor_id` | UUID | |
| `tenant_id` | UUID | Null = platform-level operation |
| `requires_approval` | bool | |
| `approval_request_id` | UUID | FK → approval_requests |
| `status` | enum | `pending` / `approved` / `executing` / `success` / `failed` / `cancelled` |
| `result_payload` | jsonb | FreeSWITCH response |
| `error_message` | text | |
| `requested_at` | timestamptz | |
| `executed_at` | timestamptz | |
| `completed_at` | timestamptz | |

### RuntimeOperationPolicy

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `action_type` | text | |
| `requires_approval` | bool | |
| `approval_role` | text | Minimum role for approval |
| `active_call_threshold` | int | Block if active calls > N |
| `allowed_actor_roles` | text[] | Roles that can trigger this action |

---

## API Design

### Read-only node status

```
GET /api/v1/platform/nodes/:id/status        (platform admin)
GET /api/v1/platform/nodes/:id/modules       (platform admin)
GET /api/v1/platform/nodes/:id/gateways      (platform admin)
GET /api/v1/platform/nodes/:id/channels      (platform admin)
GET /api/v1/platform/nodes/:id/registrations (platform admin)

# Tenant-scoped (own gateways only)
GET /api/v1/runtime/gateway-status
```

### Controlled runtime operations

```
GET    /api/v1/platform/runtime-operations
POST   /api/v1/platform/runtime-operations
GET    /api/v1/platform/runtime-operations/:id
DELETE /api/v1/platform/runtime-operations/:id  (cancel pending)

# Runtime policy management
GET    /api/v1/platform/runtime-operation-policy
PUT    /api/v1/platform/runtime-operation-policy
```

### Request Example

**Request reloadxml:**
```json
POST /api/v1/platform/runtime-operations
{
  "target_node_id": "fs-node-uuid",
  "action_type": "reloadxml"
}
```

**Request sofia profile rescan:**
```json
POST /api/v1/platform/runtime-operations
{
  "target_node_id": "fs-node-uuid",
  "action_type": "sofia_profile_rescan",
  "action_params": { "profile": "external" }
}
```

### Authorization

| Action | Required role |
|---|---|
| Read node status | `platform_admin` |
| Read tenant gateway status | `tenant_admin` or higher |
| Create runtime operation | `platform_admin` |
| Approve runtime operation | Per policy — `platform_admin` or `tenant_admin` |
| Cancel runtime operation | `platform_admin` |
| Manage operation policy | `platform_admin` |

---

## Database Design

```sql
CREATE TABLE runtime_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_node_id UUID NOT NULL REFERENCES freeswitch_nodes(id),
  action_type TEXT NOT NULL,
  action_params JSONB NOT NULL DEFAULT '{}',
  actor_type TEXT NOT NULL,
  actor_id UUID,
  tenant_id UUID REFERENCES tenants(id),
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  approval_request_id UUID,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','executing','success','failed','cancelled')),
  result_payload JSONB,
  error_message TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE runtime_operation_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL UNIQUE,
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  approval_role TEXT NOT NULL DEFAULT 'platform_admin',
  active_call_threshold INT NOT NULL DEFAULT 0,
  allowed_actor_roles TEXT[] NOT NULL DEFAULT '{platform_admin}'
);

CREATE INDEX ON runtime_operations (target_node_id, status);
CREATE INDEX ON runtime_operations (tenant_id) WHERE tenant_id IS NOT NULL;
```

---

## FreeSWITCH Integration

### Go agent role for read-only status

The Go agent exposes a `/status` endpoint that the API queries periodically:

```
GET http://<go-agent>:8080/status
```

Response:
```json
{
  "node_id": "fs-node-uuid",
  "freeswitch_version": "1.10.11",
  "loaded_modules": ["mod_sofia", "mod_conference", ...],
  "sofia_profiles": {
    "internal": { "state": "RUNNING", "gateways": {} },
    "external": { "state": "RUNNING", "gateways": {
      "trunk-uuid": { "state": "REGED", "ping_ms": 45 }
    }}
  },
  "active_channels": 12,
  "active_registrations": 34
}
```

The Go agent collects this by issuing safe read-only ESL commands on a polling
interval.

### Go agent role for controlled actions

For controlled actions, the API sends an apply request to the Go agent:

```
POST http://<go-agent>:8080/execute-operation
{
  "operation_id": "op-uuid",
  "action_type": "sofia_profile_rescan",
  "action_params": { "profile": "external" }
}
```

Go agent validates action type against its local allowlist, executes the ESL
command, and reports results back to the API.

---

## UI/UX Design

### FreeSWITCH node health page

- Node list with status indicator (healthy / degraded / offline).
- Per-node: version, active channels, active registrations.
- Module status: loaded vs. required, missing highlighted in red.

### Module status page

- Required modules checklist per node.
- Loaded module list.
- Missing required modules alert banner.

### Runtime actions panel

- Safe runtime actions with descriptions.
- Each action shows: requires approval, risk level, active call count.
- Action confirmation dialog with impact summary.
- Approval status and history.

### Approval indicators

- "Approval required" badge on high-risk actions.
- Pending approval state with actor and timestamp.

### Action history

- Chronological list: action type, node, actor, status, timestamp, result summary.

---

## MCP/n8n Exposure

| Tool / event | Allowed | Notes |
|---|---|---|
| `get_node_status` (read-only) | Yes | Platform admin only |
| `list_gateway_statuses` (read-only) | Yes | Tenant admin scoped to own gateways |
| Execute runtime operation via MCP | No | Dangerous actions are UI/approval-only |
| n8n webhook: `runtime.module_missing` | Yes | Informational alert |
| n8n webhook: `runtime.operation_success` | Yes | Informational |
| n8n webhook: `runtime.operation_failed` | Yes | Informational |

---

## Security and Tenant Isolation

- Read-only status endpoints are `platform_admin` only except gateway status
  which is exposed to `tenant_admin` scoped to their own trunks/gateways.
- Runtime operations are `platform_admin` only.
- All controlled action types are enforced from an enum in the API service layer —
  no user-provided action string reaches ESL.
- Action parameters (profile name, gateway name) are validated against known
  registered values, not passed raw from user input.
- Go agent maintains its own local allowlist as a defense-in-depth measure.
- Active call count gate prevents destructive operations on busy profiles.

---

## Audit Events

| Event | Trigger |
|---|---|
| `runtime.operation_requested` | Operation created |
| `runtime.operation_approval_requested` | Approval required — request created |
| `runtime.operation_approved` | Approval granted |
| `runtime.operation_rejected` | Approval rejected |
| `runtime.operation_executing` | Go agent starting command |
| `runtime.operation_success` | Command succeeded |
| `runtime.operation_failed` | Command failed |
| `runtime.operation_cancelled` | Operation cancelled before execution |
| `runtime.module_missing` | Required module not loaded on a node |

---

## Testing Strategy

| Test type | Required |
|---|---|
| Unit — allowlist enforcement | Non-allowlisted actions are rejected |
| Unit — policy check | Operation blocked when active calls exceed threshold |
| Unit — approval gate | High-risk actions require approval before execution |
| Integration — tenant isolation | Tenant admin cannot trigger platform-level operations |
| Integration — operation lifecycle | pending → approved → executing → success/failed |
| Integration — audit | Every operation creates an audit event |
| Runtime smoke | reloadxml triggered via UI → Go agent executes → result recorded |

---

## Release Stage Recommendation

| Stage | Recommendation |
|---|---|
| Public alpha | Not required |
| Public beta | Read-only node status P1 (dashboard visibility) |
| Production | Controlled actions P1/P2; arbitrary module management out of scope |

---

## Open Questions

- Should the Go agent status endpoint be polled by the API or should it push
  status via SSE/webhook to the API?
- Should the module missing alert be a `SecurityAlert` using the existing alert
  rules system?
- What polling interval is appropriate for node status (every 30s, 60s)?
- Should node status be persisted as a history table or only as a live cache?
- Should `sofia_profile_restart` (which drops active calls) require a higher
  approval role than `platform_admin`?
