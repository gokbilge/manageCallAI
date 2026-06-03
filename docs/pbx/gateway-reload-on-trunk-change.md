# Gateway Reload on Trunk Change — Design

Status: **Designed, not implemented.**
Priority: **P0 for production. P1 for public beta if trunk operations are in beta scope.**

This is the highest-priority item in the PBX Completeness Layer.

---

## Goal

When a SIP trunk's desired state changes in manageCallAI, the system should safely
apply or request apply of the new gateway configuration to the affected FreeSWITCH
node(s) without requiring manual CLI work from an operator.

Currently, trunk CRUD is implemented and the gateway XML is served via
`mod_xml_curl`, but no mechanism exists to notify FreeSWITCH to rescan or reload
the gateway after a change. Operators must manually run `reloadxml` and
`sofia profile <profile> rescan` in the FreeSWITCH CLI.

---

## User Stories

- As a tenant admin, I change a SIP trunk's proxy address. I want FreeSWITCH to
  pick up the new gateway config within seconds, not require a manual CLI session.
- As a platform operator, I want to see which FreeSWITCH nodes are affected when a
  trunk changes and review the reload plan before applying it.
- As an operator, I want approval required before a gateway reload is applied if
  there are active calls on the affected profile.
- As an auditor, I want to see who triggered the gateway reload, when it was
  applied, and whether it succeeded.

---

## Non-Goals

- No arbitrary ESL command passthrough.
- No raw XML editing through the API.
- No shell access to FreeSWITCH from the API or UI.
- No unrestricted `sofia` command surface — only safe allowlisted operations.

---

## Domain Model

### RuntimeApplyRequest

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → tenants (null = platform-level) |
| `triggered_by_type` | text | `user` / `workflow` / `system` |
| `triggered_by_id` | UUID | Actor ID |
| `action_type` | enum | See safe action types |
| `target_node_id` | UUID | FK → freeswitch_nodes |
| `target_profile` | text | Sofia profile name (e.g., `external`) |
| `target_gateway` | text | Gateway name derived from trunk ID |
| `object_type` | text | e.g., `sip_trunk` |
| `object_id` | UUID | FK → sip_trunks |
| `status` | enum | `pending` / `approved` / `applying` / `applied` / `failed` / `cancelled` |
| `requires_approval` | bool | From approval policy |
| `approval_request_id` | UUID | FK → approval_requests (if applicable) |
| `active_call_count` | int | Active calls on profile at request time |
| `scheduled_at` | timestamptz | Null = apply immediately |
| `applied_at` | timestamptz | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### RuntimeApplyResult

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `apply_request_id` | UUID | FK → runtime_apply_requests |
| `node_id` | UUID | FK → freeswitch_nodes |
| `action_type` | text | The action executed |
| `status` | enum | `success` / `failure` / `partial` |
| `response_payload` | jsonb | FreeSWITCH command response |
| `error_message` | text | Null on success |
| `executed_at` | timestamptz | |

### Allowlisted Safe Actions

| Action type | FreeSWITCH command | Notes |
|---|---|---|
| `reloadxml` | `api reloadxml` | Reloads all XML from mod_xml_curl |
| `sofia_profile_rescan` | `api sofia profile <profile> rescan` | Re-reads gateways without dropping calls |
| `sofia_profile_killgw` | `api sofia profile <profile> killgw <gateway>` | Kills a specific gateway |
| `sofia_profile_restartgw` | `api sofia profile <profile> restartgw <gateway>` | Restarts a specific gateway |
| `sofia_status_gateway` | `api sofia status gateway <gateway>` | Read-only status query |
| `sofia_status_profile` | `api sofia status profile <profile>` | Read-only status query |

No other FreeSWITCH commands are allowed. The allowlist is enforced in the API
service layer, not only in documentation.

---

## Workflow

### Automatic apply (no approval required)

```
1. Operator updates SIP trunk via PATCH /api/v1/sip-trunks/:id
2. API validates trunk config, stores desired state in PostgreSQL
3. API determines affected FreeSWITCH nodes via freeswitch_nodes registry
4. API determines affected Sofia profile from node SIP profile config
5. API checks active call count on the profile (from runtime state if available)
6. API creates RuntimeApplyRequest (status = pending)
7. API writes audit event: trunk_change_apply_requested
8. Go agent or API runtime endpoint sends safe ESL commands:
   a. sofia profile <profile> killgw <gateway>   (remove old gateway)
   b. reloadxml                                  (serve new gateway XML)
   c. sofia profile <profile> rescan             (reload gateways)
   d. sofia status gateway <gateway>             (verify gateway is up)
9. Go agent reports result → API updates RuntimeApplyRequest (status = applied)
10. API writes audit event: trunk_change_applied
11. UI shows: Applied ✓
```

### Approval-gated apply

```
1–6. Same as above.
7. API creates ApprovalRequest (object_type = runtime_apply_request)
8. RuntimeApplyRequest status = pending_approval
9. API writes audit event: trunk_change_apply_approval_requested
10. Operator approves in UI
11. ApprovalRequest status = approved
12. API continues from step 8 above
```

### Manual/scheduled apply

Operator can also:
- Click "Apply now" from the trunk change summary UI.
- Schedule apply for a future time (simple delay, not full scheduler).

---

## API Design

### Apply request management

```
GET    /api/v1/sip-trunks/:id/apply-requests
POST   /api/v1/sip-trunks/:id/apply-now
GET    /api/v1/runtime/apply-requests
GET    /api/v1/runtime/apply-requests/:id

# Platform admin only
GET    /api/v1/platform/apply-requests
```

### Apply triggers (automatic from trunk PATCH)

The `PATCH /api/v1/sip-trunks/:id` response includes a `runtime_apply` field
indicating whether an apply request was created:

```json
{
  "id": "trunk-uuid",
  "name": "Primary Carrier",
  "status": "active",
  "runtime_apply": {
    "request_id": "apply-request-uuid",
    "status": "applying",
    "requires_approval": false,
    "affected_nodes": ["fs-node-1"]
  }
}
```

### Runtime callback (Go agent → API)

```
POST /api/v1/runtime/apply-requests/:id/result
```

```json
{
  "node_id": "fs-node-uuid",
  "action_type": "sofia_profile_rescan",
  "status": "success",
  "response_payload": { "raw": "OK" },
  "executed_at": "2026-06-03T12:00:01Z"
}
```

### Authorization

| Action | Required role |
|---|---|
| List apply requests for a trunk | `tenant_operator` or higher |
| Trigger apply-now | `tenant_admin` |
| View platform apply requests | `platform_admin` |
| Approve apply request | Per approval policy |
| Go agent result callback | Runtime HMAC node auth only |

---

## Database Design

```sql
CREATE TABLE runtime_apply_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  triggered_by_type TEXT NOT NULL,
  triggered_by_id UUID,
  action_type TEXT NOT NULL,
  target_node_id UUID NOT NULL REFERENCES freeswitch_nodes(id),
  target_profile TEXT,
  target_gateway TEXT,
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','pending_approval','approved','applying','applied','failed','cancelled')),
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  approval_request_id UUID,
  active_call_count INT,
  scheduled_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE runtime_apply_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apply_request_id UUID NOT NULL REFERENCES runtime_apply_requests(id),
  node_id UUID NOT NULL REFERENCES freeswitch_nodes(id),
  action_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success','failure','partial')),
  response_payload JSONB,
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON runtime_apply_requests (tenant_id, status);
CREATE INDEX ON runtime_apply_requests (object_type, object_id);
CREATE INDEX ON runtime_apply_results (apply_request_id);
```

---

## FreeSWITCH Integration

### Go agent role

The Go agent (`apps/freeswitch-agent`) is extended with a `RuntimeApplyClient`
that:

1. Receives apply request instructions from the API (via HTTP callback or by
   polling a work queue endpoint).
2. Validates the action type against the allowlist.
3. Sends ESL commands in safe order.
4. Parses FreeSWITCH command responses.
5. Reports results back to the API.

### Safe ESL command order for gateway reload

```
1. sofia profile <profile> killgw <gateway>
   (wait 500ms or watch for BACKGROUND_JOB response)
2. api reloadxml
   (FreeSWITCH fetches new config from mod_xml_curl)
3. sofia profile <profile> rescan
   (loads new gateway from reloaded XML)
4. sofia status gateway <gateway>
   (verify REGED state)
```

Implemented as a structured sequence in the Go agent — not as arbitrary ESL.

### Active call safety

Before step 1, the Go agent queries active call count via:
```
api show channels as json
```

If active calls > 0 and approval is required for live-call changes, the API
requires an explicit operator override or a scheduled apply.

### Rollback / failure handling

If the gateway does not reach REGED state within the timeout:

1. Go agent reports `failure` to the API.
2. API updates apply request status to `failed`.
3. API writes audit event with error detail.
4. UI shows failure state with rollback guidance.
5. Operator can click "Revert to previous trunk config" to restore the prior
   desired state and trigger a new apply.

---

## UI/UX Design

### Trunk change summary panel

Appears after PATCH/PUT trunk update:

- Summary of changed fields.
- Generated gateway XML preview (collapsible diff).
- Affected FreeSWITCH node(s).
- Active call count on the profile.
- Apply options:
  - Apply now (immediate, if no approval required).
  - Schedule apply (simple future timestamp).
  - Request approval (if policy requires).
- Apply status badge: Pending / Applying / Applied / Failed.

### Apply request list

Per-trunk apply request history: timestamp, actor, action type, status, result.

### Approval pending state

If approval required: shows "Awaiting approval from tenant admin" with approval
request link.

### Failure state

If apply failed:
- Error message from FreeSWITCH response.
- "Revert to previous config" button.
- Rollback guidance text.

---

## MCP/n8n Exposure

| Tool / event | Allowed | Notes |
|---|---|---|
| `list_sip_trunks` | Yes | Read-only |
| `get_sip_trunk` | Yes | Read-only |
| n8n webhook: `trunk.apply_requested` | Yes | Informational |
| n8n webhook: `trunk.apply_applied` | Yes | Informational |
| n8n webhook: `trunk.apply_failed` | Yes | Informational |
| Trigger apply via MCP | No | Admin-only |
| Raw sofia/ESL via MCP | Never | |

---

## Security and Tenant Isolation

- Apply requests are tenant-scoped.
- The allowlist of safe ESL commands is enforced in the API service layer with an
  explicit enum — no string interpolation from user input reaches ESL.
- FreeSWITCH node IDs in apply requests must be registered in `freeswitch_nodes`
  and authorized for the tenant context.
- Go agent validates action type against its own local allowlist before sending ESL.
- Active call count check before destructive gateway operations.
- Tenant A cannot trigger a gateway reload on a node scoped to Tenant B.

---

## Audit Events

| Event | Trigger |
|---|---|
| `trunk.updated` | SIP trunk desired state changed |
| `trunk.apply_requested` | RuntimeApplyRequest created |
| `trunk.apply_approval_requested` | Approval required — request created |
| `trunk.apply_approved` | Approval granted |
| `trunk.apply_rejected` | Approval rejected |
| `trunk.apply_applying` | Go agent starting apply commands |
| `trunk.apply_applied` | Gateway reload applied successfully |
| `trunk.apply_failed` | Gateway reload failed |
| `trunk.apply_cancelled` | Apply request cancelled by operator |

---

## Approval Policy Integration

Approval is required when:

- `active_call_count > 0` on the affected profile (configurable threshold).
- Tenant approval policy requires it for trunk changes.
- The trunk is flagged as production-critical.

The approval follows the existing `ApprovalRequest` model:
`object_type = 'runtime_apply_request'`.

---

## Testing Strategy

| Test type | Required |
|---|---|
| Unit — allowlist enforcement | Non-allowlisted actions are rejected at service layer |
| Unit — ESL command order | Correct safe command sequence is built |
| Unit — active call count gate | Apply blocked/requires approval when calls active |
| Integration — tenant isolation | Tenant A cannot apply to nodes scoped to Tenant B |
| Integration — apply request lifecycle | pending → applying → applied / failed |
| Integration — approval gate | Approval required correctly blocks auto-apply |
| Integration — Go agent callback | Result correctly updates apply request and writes audit |
| Integration — rollback guidance | Failed apply shows prior config as revert target |
| Runtime smoke | Real trunk change on self-hosted FreeSWITCH: gateway reloads, REGED confirmed |

---

## Runtime Evidence Required

Before production promotion:

- Live FreeSWITCH smoke on self-hosted runner: trunk PATCH → apply request
  created → Go agent sends ESL commands → gateway REGED → audit events written.
- Failure case: invalid gateway → apply failed → failure recorded.
- Evidence artifact tied to the RC commit (self-hosted runner run URL).

---

## Release Stage Recommendation

| Stage | Recommendation |
|---|---|
| Public beta | P1 if trunk operations are in beta scope — at minimum, UI should show "apply required manually" with guidance |
| Production | P0 — operators must not need FreeSWITCH CLI access for routine trunk changes |

---

## Open Questions

- Should the apply request support multi-node fan-out (one trunk change affecting
  multiple FS nodes with separate per-node results)?
- Should scheduled apply use a simple timestamp or integrate with a job scheduler?
- Should the Go agent poll for pending apply requests or receive them as a push
  from the API?
- What is the maximum timeout for gateway REGED verification?
- Should the active call count threshold for auto-approval be a tenant-level
  policy setting?
