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

All protected endpoints require authenticated access.

Suggested pattern:

```text
Authorization: Bearer <token>
```

### 3.4 Tenant Context

For MVP single-tenant mode, tenant context may be implicit.

For multi-tenant mode, tenant context should be resolved from authentication context rather than caller-supplied arbitrary tenant IDs where possible.

### 3.5 Common Response Metadata

Suggested envelope for collection responses:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 50,
  "total": 0
}
```

Single-resource responses may return the resource directly unless the implementation standardizes on envelopes.

## 4. Resource Overview

Primary resources:

- `users`
- `extensions`
- `trunks`
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

Suggested error shape:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "The flow contains an unreachable node.",
    "details": [
      {
        "field": "definition.nodes[3]",
        "reason": "unreachable"
      }
    ],
    "requestId": "req_123"
  }
}
```

Suggested error codes:

- `unauthenticated`
- `unauthorized`
- `not_found`
- `conflict`
- `validation_failed`
- `simulation_failed`
- `approval_required`
- `invalid_state_transition`
- `rate_limited`
- `internal_error`

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
  "items": [
    {
      "id": "ext_001",
      "extensionNumber": "1001",
      "displayName": "Sales Front Desk",
      "status": "active",
      "defaultDestinationType": "flow",
      "defaultDestinationId": "flow_main"
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 1
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

> **Note:** SIP passwords are stored as plaintext in the database for MVP. Encryption-at-rest is planned before production use.

#### Get Extension

```http
GET /api/v1/extensions/{extensionId}
```

#### Update Extension

```http
PATCH /api/v1/extensions/{extensionId}
```

#### Deactivate Extension

```http
POST /api/v1/extensions/{extensionId}/deactivate
```

### 6.2 Trunks

#### List Trunks

```http
GET /api/v1/trunks
```

#### Create Trunk

```http
POST /api/v1/trunks
```

Example request:

```json
{
  "name": "Primary SIP Provider",
  "direction": "bidirectional",
  "providerName": "ExampleTel",
  "authenticationProfile": {
    "type": "digest"
  },
  "networkProfile": {
    "transport": "udp"
  }
}
```

#### Get Trunk

```http
GET /api/v1/trunks/{trunkId}
```

#### Update Trunk

```http
PATCH /api/v1/trunks/{trunkId}
```

### 6.3 Numbers

#### List Numbers

```http
GET /api/v1/numbers
```

#### Create Number

```http
POST /api/v1/numbers
```

Example request:

```json
{
  "e164Number": "+15551234567",
  "displayLabel": "Main Office",
  "trunkId": "trunk_001",
  "assignedTargetType": "inbound_route",
  "assignedTargetId": "route_main"
}
```

#### Get Number

```http
GET /api/v1/numbers/{numberId}
```

#### Update Number

```http
PATCH /api/v1/numbers/{numberId}
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
  "matchType": "did",
  "matchValue": "+15551234567",
  "targetType": "flow",
  "targetId": "flow_main"
}
```

#### Get Inbound Route

```http
GET /api/v1/inbound-routes/{routeId}
```

#### Update Inbound Route Draft

```http
PATCH /api/v1/inbound-routes/{routeId}
```

#### Validate Inbound Route

```http
POST /api/v1/inbound-routes/{routeId}/validate
```

#### Publish Inbound Route

```http
POST /api/v1/inbound-routes/{routeId}/publish
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
  "name": "Main Greeting",
  "mediaType": "audio/wav",
  "language": "en-US"
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

### 6.7 Flows

#### List Flows

```http
GET /api/v1/flows
```

Query parameters:

- `status`
- `search`
- `page`
- `pageSize`

#### Create Flow

```http
POST /api/v1/flows
```

Example request:

```json
{
  "name": "Main IVR",
  "description": "Primary inbound caller menu",
  "draftDefinition": {
    "startNodeId": "n1",
    "nodes": [
      {
        "id": "n1",
        "type": "play_prompt",
        "promptId": "prompt_greeting"
      }
    ],
    "edges": []
  }
}
```

#### Get Flow

```http
GET /api/v1/flows/{flowId}
```

Suggested response:

```json
{
  "id": "flow_main",
  "name": "Main IVR",
  "description": "Primary inbound caller menu",
  "status": "draft",
  "draftVersionId": "flowver_001",
  "activeVersionId": null
}
```

#### Update Flow Draft

```http
PATCH /api/v1/flows/{flowId}
```

#### Get Flow Versions

```http
GET /api/v1/flows/{flowId}/versions
```

#### Get Flow Version

```http
GET /api/v1/flows/{flowId}/versions/{versionId}
```

#### Validate Flow

```http
POST /api/v1/flows/{flowId}/validate
```

Example response:

```json
{
  "id": "val_001",
  "objectType": "flow",
  "objectId": "flow_main",
  "versionId": "flowver_001",
  "status": "passed",
  "errors": [],
  "warnings": []
}
```

#### Simulate Flow

```http
POST /api/v1/flows/{flowId}/simulate
```

Example request:

```json
{
  "scenario": {
    "inboundNumber": "+15551234567",
    "dtmfSequence": ["1", "2"]
  }
}
```

#### Publish Flow

```http
POST /api/v1/flows/{flowId}/publish
```

Example request:

```json
{
  "reason": "Release approved main menu update"
}
```

Example response:

```json
{
  "publishId": "pub_001",
  "objectType": "flow",
  "objectId": "flow_main",
  "versionId": "flowver_001",
  "actionType": "publish",
  "result": "success"
}
```

#### Roll Back Flow

```http
POST /api/v1/flows/{flowId}/rollback
```

Example request:

```json
{
  "targetVersionId": "flowver_000",
  "reason": "Restore previous stable version"
}
```

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
