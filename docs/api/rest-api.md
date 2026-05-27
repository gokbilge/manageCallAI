# manageCallAI REST API Contract

## 1. Purpose

This document defines the initial REST API contract for `manageCallAI`.

It focuses on business-level resources and lifecycle operations rather than low-level FreeSWITCH primitives.

Machine-readable contract:

- [openapi.yaml](openapi.yaml)

## 2. API Design Principles

- Expose business objects, not raw switch internals
- Keep lifecycle operations explicit: validate, simulate, publish, rollback
- Maintain stable resource naming across UI, automation, and integrations
- Keep AI-specific constraints in MCP rather than weakening the REST model
- Prefer auditable, structured, machine-usable payloads

## 3. Base Conventions

### 3.1 Base Path

Suggested base path:

```text
/api/v1
```

### 3.2 Content Type

Requests and responses should use JSON:

```text
application/json
```

### 3.3 Authentication

**Human-facing endpoints** require a user JWT:

```text
Authorization: Bearer <JWT>
```

The JWT is issued by `/auth/register` or `/auth/login` and includes claims:
`sub`, `tenant_id`, `email`, `role` (`tenant_admin` | `platform_admin`).

**Runtime-internal endpoints** (`/freeswitch/*`, `/call-events/internal/ingest`)
are called by FreeSWITCH and the Go ESL agent — not by end users. They require
a shared runtime token:

```text
Authorization: Bearer <RUNTIME_API_TOKEN>
# or
x-managecallai-runtime-token: <RUNTIME_API_TOKEN>
```

The `runtime_token` query parameter is accepted only as a local/dev fallback for
`mod_xml_curl` setups that cannot send custom headers.

### 3.4 Tenant Context

For MVP single-tenant mode, tenant context may be implicit.

For multi-tenant mode, tenant context should be resolved from authentication context rather than caller-supplied arbitrary tenant IDs where possible.

### 3.5 Common Response Metadata

Current MVP implementation standardizes on a simple `data` envelope:

```json
{
  "data": []
}
```

For single-resource responses:

```json
{
  "data": {
    "id": "..."
  }
}
```

## 4. Resource Overview

Primary resources:

- `users`
- `extensions`
- `sip-trunks`
- `numbers`
- `inbound-routes`
- `outbound-routes`
- `prompts`
- `flows`
- `validations`
- `simulations`
- `publishes`
- `approvals`
- `audit-events`
- `call-events`
- `cdrs`

## 5. Error Model

Current MVP implementation returns a flat error string:

```json
{
  "error": "Extension not found"
}
```

HTTP status codes carry the error class (401 = unauthenticated, 403 = forbidden,
404 = not found, 409 = conflict, 422 = domain validation failure, 500 = server error).
Structured error codes and detail arrays may be added in a future iteration.

## 6. Resource Contracts

### 6.1 Extensions

#### List Extensions

```http
GET /api/v1/extensions
```

Query parameters:

- `status`
- `search`
- `page`
- `pageSize`

Example response:

```json
{
  "data": [
    {
      "id": "ext_001",
      "extension_number": "1001",
      "display_name": "Sales Front Desk",
      "status": "active",
      "sip_username": "1001",
      "default_destination_type": "flow",
      "default_destination_id": "flow_main"
    }
  ]
}
```

#### Create Extension

```http
POST /api/v1/extensions
```

Example request:

```json
{
  "extension_number": "1001",
  "display_name": "Sales Front Desk",
  "sip_password": "PhonePass123!",
  "sip_username": "1001",
  "default_destination_type": "flow",
  "default_destination_id": "flow_main"
}
```

Required fields: `extension_number`, `display_name`, `sip_password`.
`sip_username` defaults to `extension_number` when omitted.

`sip_password` is write-only: the API accepts it on create/update and encrypts it with AES-256-GCM
before storing `sip_password_ciphertext` and `sip_password_key_id`. The plaintext is never returned
in any API response. The FreeSWITCH directory endpoint decrypts it only when generating the XML response.

Future direction: replace the symmetric master key with an external secret store (Vault, AWS Secrets Manager).

Example response:

```json
{
  "data": {
    "id": "ext_001",
    "tenant_id": "tenant_001",
    "extension_number": "1001",
    "display_name": "Sales Front Desk",
    "status": "active",
    "sip_username": "1001",
    "default_destination_type": "flow",
    "default_destination_id": "flow_main"
  }
}
```

#### Get Extension

```http
GET /api/v1/extensions/{extensionId}
```

Example response:

```json
{
  "data": {
    "id": "ext_001",
    "tenant_id": "tenant_001",
    "extension_number": "1001",
    "display_name": "Sales Front Desk",
    "status": "active",
    "sip_username": "1001",
    "default_destination_type": "flow",
    "default_destination_id": "flow_main"
  }
}
```

#### Update Extension

```http
PATCH /api/v1/extensions/{extensionId}
```

Response shape matches create/get: `{ "data": { ...extension } }`.

#### Deactivate Extension

```http
POST /api/v1/extensions/{extensionId}/deactivate
```

Response shape matches create/get: `{ "data": { ...extension } }`.

### 6.2 SIP Trunks

#### List SIP Trunks

```http
GET /api/v1/sip-trunks
```

Example response:

```json
{
  "data": [
    {
      "id": "trunk_001",
      "tenant_id": "tenant_001",
      "name": "Primary SIP Provider",
      "status": "active",
      "direction": "bidirectional",
      "realm": "sip.example.net",
      "proxy": "sip.example.net",
      "port": 5060,
      "transport": "udp",
      "username": "tenant-200",
      "auth_username": "carrier-user"
    }
  ]
}
```

#### Create SIP Trunk

```http
POST /api/v1/sip-trunks
```

Example request:

```json
{
  "name": "Primary SIP Provider",
  "direction": "bidirectional",
  "realm": "sip.example.net",
  "proxy": "sip.example.net",
  "port": 5060,
  "transport": "udp",
  "username": "tenant-200",
  "auth_username": "carrier-user",
  "auth_password": "CarrierPass123!"
}
```

Required fields: `name`, `direction`, `realm`, `proxy`, `auth_username`, `auth_password`.

`auth_password` is write-only: the API accepts it on create/update and encrypts it with AES-256-GCM
before storing `auth_password_ciphertext` and `auth_password_key_id`. The plaintext is never returned
in any API response.

Example response:

```json
{
  "data": {
    "id": "trunk_001",
    "tenant_id": "tenant_001",
    "name": "Primary SIP Provider",
    "status": "active",
    "direction": "bidirectional",
    "realm": "sip.example.net",
    "proxy": "sip.example.net",
    "port": 5060,
    "transport": "udp",
    "username": "tenant-200",
    "auth_username": "carrier-user"
  }
}
```

#### Get SIP Trunk

```http
GET /api/v1/sip-trunks/{trunkId}
```

Response shape matches create/get: `{ "data": { ...sip_trunk } }`.

#### Update SIP Trunk

```http
PATCH /api/v1/sip-trunks/{trunkId}
```

Response shape matches create/get: `{ "data": { ...sip_trunk } }`.

#### Deactivate SIP Trunk

```http
POST /api/v1/sip-trunks/{trunkId}/deactivate
```

Response shape matches create/get: `{ "data": { ...sip_trunk } }`.

### 6.3 Phone Numbers

#### List Phone Numbers

```http
GET /api/v1/phone-numbers
```

#### Create Phone Number

```http
POST /api/v1/phone-numbers
```

Example request:

```json
{
  "e164_number": "+15551234567",
  "display_label": "Main Office",
  "trunk_id": "trunk_001"
}
```

All fields use snake_case. `assigned_target_type` and `assigned_target_id` are
set via PATCH after creation.

#### Get Phone Number

```http
GET /api/v1/phone-numbers/{numberId}
```

#### Update Phone Number

```http
PATCH /api/v1/phone-numbers/{numberId}
```

### 6.4 Inbound Routes

#### List Inbound Routes

```http
GET /api/v1/inbound-routes
```

#### Create Inbound Route

```http
POST /api/v1/inbound-routes
```

Example request:

```json
{
  "name": "Main Number Route",
  "match_type": "did",
  "match_value": "+15551234567",
  "phone_number_id": "num_001",
  "target_type": "flow",
  "target_id": "flow_main"
}
```

`phone_number_id` is optional. When supplied:

- it must reference a phone number owned by the same tenant
- `match_type` must be `did`
- the backend normalizes `match_value` from the linked phone number's `e164_number`

#### Get Inbound Route

```http
GET /api/v1/inbound-routes/{routeId}
```

#### Update Inbound Route Draft

```http
PATCH /api/v1/inbound-routes/{routeId}
```

#### Create Inbound Route Version

```http
POST /api/v1/inbound-routes/{routeId}/versions
```

#### Validate Inbound Route

```http
POST /api/v1/inbound-routes/{routeId}/versions/{versionId}/validate
```

#### Publish Inbound Route

```http
POST /api/v1/inbound-routes/{routeId}/versions/{versionId}/publish
```

#### Roll Back Inbound Route

```http
POST /api/v1/inbound-routes/{routeId}/rollback
```

Example rollback request:

```json
{
  "targetVersionId": "routever_003",
  "reason": "Restore prior known-good route"
}
```

### 6.4.1 FreeSWITCH Dialplan Projection

#### Project Inbound DID to FreeSWITCH Dialplan XML

```http
GET /api/v1/freeswitch/dialplan?Caller-Destination-Number=%2B15551234567&domain=acme-demo.managecallai.local
```

This is a runtime-internal endpoint. It requires the runtime token and returns
FreeSWITCH XML dialplan for active inbound DID routes that currently resolve to
an `extension` target.

Expected behavior:

- unknown domain or DID returns empty dialplan XML
- unpublished routes are ignored
- DID routes bound through `phone_number_id` resolve using the linked phone number's `e164_number`
- the XML bridges to `sofia/internal/<extension_number>@<directory_domain>`

Example response fragment:

```xml
<section name="dialplan">
  <context name="default">
    <extension name="managecall_inbound_route_001" continue="false">
      <condition field="destination_number" expression="^\+15551234567$">
        <action application="set" data="managecall_route_id=route_001" />
        <action application="bridge" data="sofia/internal/200@acme-demo.managecallai.local" />
      </condition>
    </extension>
  </context>
</section>
```

### 6.5 Outbound Routes

#### List Outbound Routes

```http
GET /api/v1/outbound-routes
```

#### Create Outbound Route

```http
POST /api/v1/outbound-routes
```

#### Get Outbound Route

```http
GET /api/v1/outbound-routes/{routeId}
```

#### Update Outbound Route Draft

```http
PATCH /api/v1/outbound-routes/{routeId}
```

#### Validate Outbound Route

```http
POST /api/v1/outbound-routes/{routeId}/validate
```

#### Publish Outbound Route

```http
POST /api/v1/outbound-routes/{routeId}/publish
```

### 6.6 Prompts

#### List Prompts

```http
GET /api/v1/prompts
```

#### Create Prompt Metadata

```http
POST /api/v1/prompts
```

Example request:

```json
{
  "name": "main_greeting_tr",
  "media_type": "audio/wav",
  "language": "tr-TR",
  "storage_uri": "/sounds/tenants/acme/main_greeting_tr.wav",
  "checksum": "sha256:abc123"
}
```

Example response:

```json
{
  "data": {
    "id": "prompt_001",
    "tenant_id": "tenant_001",
    "name": "main_greeting_tr",
    "media_type": "audio/wav",
    "language": "tr-TR",
    "storage_uri": "/sounds/tenants/acme/main_greeting_tr.wav",
    "checksum": "sha256:abc123",
    "status": "active"
  }
}
```

#### Get Prompt

```http
GET /api/v1/prompts/{promptId}
```

#### Update Prompt

```http
PATCH /api/v1/prompts/{promptId}
```

### 6.7 IVR Flows

Implemented IVR endpoints use the `ivr-flows` resource name and snake_case graph fields.

#### List IVR Flows

```http
GET /api/v1/ivr-flows
```

#### Create IVR Flow

```http
POST /api/v1/ivr-flows
```

Example request:

```json
{
  "name": "Main IVR",
  "description": "Primary inbound caller menu",
  "graph_json": {
    "entry_node_id": "start",
    "nodes": [
      {
        "id": "start",
        "type": "start",
        "next_node_id": "end"
      },
      {
        "id": "end",
        "type": "hangup"
      }
    ]
  }
}
```

`graph_json` is optional. When omitted, the backend creates a minimal `start -> hangup` draft graph.

#### Get IVR Flow

```http
GET /api/v1/ivr-flows/{flowId}
```

Returns the flow plus `versions`.

#### Update IVR Flow Metadata

```http
PATCH /api/v1/ivr-flows/{flowId}
```

Currently supports: `name`, `description`, `status`.

#### List IVR Flow Versions

```http
GET /api/v1/ivr-flows/{flowId}/versions
```

#### Create IVR Flow Version

```http
POST /api/v1/ivr-flows/{flowId}/versions
```

Example request:

```json
{
  "graph_json": {
    "entry_node_id": "start",
    "nodes": [
      {
        "id": "start",
        "type": "start",
        "next_node_id": "menu"
      },
      {
        "id": "menu",
        "type": "play_collect",
        "next_node_id": "end",
        "timeout_node_id": "end",
        "invalid_node_id": "end"
      },
      {
        "id": "end",
        "type": "hangup"
      }
    ]
  }
}
```

If the request body omits `graph_json`, the backend copies the current draft graph.

#### Get IVR Flow Version

```http
GET /api/v1/ivr-flows/{flowId}/versions/{versionId}
```

#### Update Draft IVR Flow Version

```http
PATCH /api/v1/ivr-flows/{flowId}/versions/{versionId}
```

The request accepts `graph_json`. `definition` is still accepted as a compatibility alias during the transition to the newer graph contract.

#### Validate Current Draft

```http
POST /api/v1/ivr-flows/{flowId}/validate
```

#### Validate Specific Version

```http
POST /api/v1/ivr-flows/{flowId}/versions/{versionId}/validate
```

Current MVP validation scope is structural only:

- `graph_json` must be an object
- `entry_node_id` must exist
- `nodes` must exist
- node IDs must be unique
- referenced node IDs must exist

The implementation now also performs tenant-scoped semantic checks for current
MVP runtime nodes:

- `play_prompt` and `play_collect` must reference an active prompt asset
- prompt assets used by runtime nodes must have `storage_uri`
- `transfer_extension` must reference an active extension in the same tenant

Example response:

```json
{
  "data": {
    "version": {
      "id": "flowver_001",
      "state": "validated"
    },
    "outcome": {
      "status": "passed",
      "errors": [],
      "warnings": []
    }
  }
}
```

#### Simulate Current Draft

```http
POST /api/v1/ivr-flows/{flowId}/simulate
```

#### Simulate Specific Version

```http
POST /api/v1/ivr-flows/{flowId}/versions/{versionId}/simulate
```

Example request:

```json
{
  "digits": ["1"],
  "caller_number": "+905551112233",
  "now": "2026-05-27T10:00:00+03:00"
}
```

Richer scenarios can also provide:

- `collected_digits` keyed by node ID for multi-step menus
- `force_timeout_nodes` for per-node timeout simulation
- `force_invalid_nodes` for per-node invalid-input simulation
- `variables` for `switch` inputs like `{{var.customer_tier}}`

Example multi-step request:

```json
{
  "collected_digits": {
    "language_menu": "9",
    "department_menu": "2"
  },
  "caller_number": "+905551112233",
  "now": "2026-05-27T10:00:00+03:00",
  "variables": {
    "customer_tier": "vip"
  }
}
```

Current MVP simulation scope:

- supports `start`, `play_prompt`, `play_collect`, `switch`, `transfer_extension`, and `hangup`
- also accepts early compatibility node types `play`, `menu`, `transfer`, and `condition`
- resolves `switch.input` from `{{last_digits}}`, `{{caller_number}}`, `{{now.hour}}`, and `{{var.<name>}}`
- persists the simulation scenario and result in `simulation_results`
- stamps `simulated_at` on the version after a successful simulation

Example response:

```json
{
  "data": {
    "version": {
      "id": "flowver_001",
      "state": "simulated"
    },
    "scenario": {
      "digits": ["1"]
    },
    "outcome": {
      "status": "passed",
      "path": ["start", "welcome", "route_digit", "sales"],
      "final_action": {
        "type": "transfer_extension",
        "extension_number": "200"
      },
      "errors": []
    }
  }
}
```

#### Publish Validated Or Simulated Version

```http
POST /api/v1/ivr-flows/{flowId}/versions/{versionId}/publish
```

If tenant policy requires approval, the endpoint returns `202 Accepted` with a pending approval envelope:

```json
{
  "data": {
    "status": "pending_approval",
    "approval_request_id": "apr_001",
    "flow": {
      "id": "flow_001",
      "active_version_id": null
    }
  }
}
```

Otherwise it publishes immediately:

```json
{
  "data": {
    "status": "published",
    "flow": {
      "id": "flow_001",
      "active_version_id": "flowver_002"
    }
  }
}
```

#### Roll Back to Previous Published Version

```http
POST /api/v1/ivr-flows/{flowId}/rollback
```

Rollback follows the same approval model:

- `200` with `{ "data": { "status": "published", "flow": { ... } } }` when it completes immediately
- `202` with `{ "data": { "status": "pending_approval", "approval_request_id": "...", "flow": { ... } } }` when tenant policy requires approval

### 6.7.1 Runtime Resolver

#### Start IVR Runtime Session

```http
POST /api/v1/runtime/ivr/sessions
```

Runtime-internal only. Requires:

```text
Authorization: Bearer <RUNTIME_API_TOKEN>
```

Example request:

```json
{
  "call_id": "call-123",
  "flow_id": "11111111-1111-1111-1111-111111111111",
  "caller_number": "+905551112233",
  "destination_number": "+902122223344",
  "variables": {
    "customer_tier": "vip"
  }
}
```

Example response:

```json
{
  "data": {
    "session": {
      "id": "sess_001",
      "flow_version_id": "flowver_002",
      "current_node_id": "welcome",
      "status": "running"
    },
    "action": {
      "action": "play_prompt",
      "node_id": "welcome",
      "prompt_id": "prompt_001",
      "prompt_uri": "/sounds/tenants/acme/welcome_tr.wav"
    }
  }
}
```

#### Advance IVR Runtime Session

```http
POST /api/v1/runtime/ivr/sessions/{sessionId}/advance
```

Example request for `play_collect` completion:

```json
{
  "node_id": "menu",
  "outcome": "digits",
  "digits": "2"
}
```

Supported outcomes:

- `completed`
- `digits`
- `timeout`
- `invalid`

The backend resolves `start` and `switch` internally and returns the next
constrained runtime action (`play_prompt`, `play_collect`, `transfer`, or
`hangup`). When a transfer or hangup action is reported complete, the session
transitions to `completed`.

### 6.8 Validations

#### List Validation Results

```http
GET /api/v1/validations
```

Query parameters:

- `objectType`
- `objectId`
- `versionId`
- `status`

#### Get Validation Result

```http
GET /api/v1/validations/{validationId}
```

### 6.9 Simulations

#### List Simulation Results

```http
GET /api/v1/simulations
```

Query parameters:

- `objectType`
- `objectId`
- `versionId`
- `status`

#### Get Simulation Result

```http
GET /api/v1/simulations/{simulationId}
```

### 6.10 Publishes

#### List Publish Records

```http
GET /api/v1/publishes
```

Query parameters:

- `objectType`
- `objectId`
- `actionType`

#### Get Publish Record

```http
GET /api/v1/publishes/{publishId}
```

### 6.11 Approvals

#### List Approval Requests

```http
GET /api/v1/approvals
```

#### Create Approval Request

```http
POST /api/v1/approvals
```

Example request:

```json
{
  "objectType": "flow",
  "objectId": "flow_main",
  "versionId": "flowver_001",
  "reason": "Production publish requires approval"
}
```

#### Approve Request

```http
POST /api/v1/approvals/{approvalId}/approve
```

#### Reject Request

```http
POST /api/v1/approvals/{approvalId}/reject
```

### 6.12 Audit Events

#### List Audit Events

```http
GET /api/v1/audit-events
```

Query parameters:

- `actorType`
- `actorId`
- `objectType`
- `objectId`
- `action`

#### Get Audit Event

```http
GET /api/v1/audit-events/{auditEventId}
```

### 6.13 Call Events

#### List Call Events

```http
GET /api/v1/call-events
```

Query parameters:

- `tenant_id` (optional, but must match the tenant in the JWT)

Current MVP implementation returns:

```json
{
  "data": [
    {
      "id": "evt_001",
      "call_id": "call-1",
      "event_type": "channel_create",
      "event_time": "2026-05-26T00:00:00.000Z",
      "source": "freeswitch-agent",
      "payload": {}
    }
  ]
}
```

Query parameters:

- `callId`
- `eventType`
- `from`
- `to`

#### Get Call Event

```http
GET /api/v1/call-events/{callEventId}
```

### 6.14 Call Detail Records

#### List CDRs

```http
GET /api/v1/cdrs
```

Query parameters:

- `callId`
- `fromNumber`
- `toNumber`
- `startFrom`
- `startTo`

#### Get CDR

```http
GET /api/v1/cdrs/{cdrId}
```

## 7. Lifecycle Operation Semantics

### 7.1 Validate

- Validates the current draft or targeted version
- Does not publish or mutate active runtime state
- Returns a validation result object

### 7.2 Simulate

- Evaluates expected behavior for a draft or version
- Does not activate runtime state
- Returns a simulation result object

### 7.3 Publish

- Attempts to activate a validated version
- May require approval depending on policy
- Records a publish record and audit event

### 7.4 Rollback

- Activates a previously published or eligible historical version
- Must record a publish record with rollback semantics
- Must not silently destroy newer history

## 8. Status Codes

Suggested usage:

- `200 OK` for successful reads and action results
- `201 Created` for resource creation
- `202 Accepted` for asynchronous operations if used
- `400 Bad Request` for malformed input
- `401 Unauthorized` for missing authentication
- `403 Forbidden` for insufficient permission
- `404 Not Found` for missing resource
- `409 Conflict` for invalid lifecycle state or uniqueness conflicts
- `422 Unprocessable Entity` for domain validation failures
- `429 Too Many Requests` for throttling
- `500 Internal Server Error` for unexpected failures

## 9. Security Constraints

- No endpoint should expose raw ESL command execution
- No endpoint should expose arbitrary FreeSWITCH XML editing as a public contract
- Sensitive trunk secrets should be handled through secure credential mechanisms, not returned casually in API reads
- Mutating endpoints should generate audit events

## 10. Future API Extensions

- Queue and agent management
- Richer approval workflow endpoints
- Bulk import or migration endpoints
- OpenAPI publication and generated SDKs
- Webhook subscription management

## 11. Relationship to Other Documents

- `../requirements/srs.md` defines required behavior
- `../design/domain-model.md` defines the underlying business entities
- `../design/software-design.md` defines the logical software decomposition
- `../architecture/overview.md` defines system boundaries and integration shape
