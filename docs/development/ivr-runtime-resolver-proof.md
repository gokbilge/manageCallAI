# IVR Runtime Resolver Proof

This document is an execution guide only.

Canonical architecture lives in [../architecture/source-of-truth.md](../architecture/source-of-truth.md).
If this file conflicts with the architecture docs, the architecture docs win.

## Purpose

Prove the first backend IVR runtime loop without requiring a visual builder or a
live FreeSWITCH call.

This slice covers:

1. prompt asset creation
2. IVR flow validation against prompt and extension references
3. runtime session start
4. runtime session advance through constrained actions

## Prerequisites

1. Copy `.env.example` to `.env`
2. Start PostgreSQL
3. Run migrations
4. Start the API

Example:

```powershell
pnpm db:up
pnpm db:migrate
pnpm --filter @managecallai/api dev
```

## 1. Register Tenant

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_name": "Acme Telecom",
    "tenant_slug": "acme-demo",
    "email": "admin@acme.test",
    "display_name": "Acme Admin",
    "password": "AdminPass123!"
  }'
```

Save the returned JWT as `TOKEN`.

## 2. Create Extension

```bash
curl -X POST http://localhost:3000/api/v1/extensions \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "extension_number": "200",
    "display_name": "Sales",
    "sip_password": "PhonePass123!"
  }'
```

Save the returned extension UUID as `EXTENSION_ID`.

## 3. Create Prompt Asset

```bash
curl -X POST http://localhost:3000/api/v1/prompts \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "welcome_tr",
    "media_type": "audio/wav",
    "language": "tr-TR",
    "storage_uri": "/sounds/tenants/acme-demo/welcome_tr.wav"
  }'
```

Save the returned prompt UUID as `PROMPT_ID`.

## 4. Create Flow

```bash
curl -X POST http://localhost:3000/api/v1/ivr-flows \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Main IVR\",
    \"graph_json\": {
      \"entry_node_id\": \"start\",
      \"nodes\": [
        { \"id\": \"start\", \"type\": \"start\", \"next_node_id\": \"welcome\" },
        { \"id\": \"welcome\", \"type\": \"play_prompt\", \"prompt_id\": \"PROMPT_ID\", \"next_node_id\": \"menu\" },
        { \"id\": \"menu\", \"type\": \"play_collect\", \"prompt_id\": \"PROMPT_ID\", \"max_digits\": 1, \"timeout_ms\": 5000, \"retries\": 2, \"next_node_id\": \"route_digit\", \"timeout_node_id\": \"end\", \"invalid_node_id\": \"end\" },
        { \"id\": \"route_digit\", \"type\": \"switch\", \"input\": \"{{last_digits}}\", \"cases\": { \"1\": \"sales\" }, \"default_node_id\": \"end\" },
        { \"id\": \"sales\", \"type\": \"transfer_extension\", \"extension_id\": \"EXTENSION_ID\" },
        { \"id\": \"end\", \"type\": \"hangup\" }
      ]
    }
  }"
```

Save:

- `FLOW_ID`
- initial `VERSION_ID`

## 5. Validate And Publish

```bash
curl -X POST http://localhost:3000/api/v1/ivr-flows/FLOW_ID/versions/VERSION_ID/validate \
  -H "Authorization: Bearer TOKEN"
```

```bash
curl -X POST http://localhost:3000/api/v1/ivr-flows/FLOW_ID/versions/VERSION_ID/publish \
  -H "Authorization: Bearer TOKEN"
```

## 6. Start Runtime Session

```bash
curl -X POST http://localhost:3000/api/v1/runtime/ivr/sessions \
  -H "Authorization: Bearer change-me-runtime-token" \
  -H "Content-Type: application/json" \
  -d "{
    \"call_id\": \"call-001\",
    \"flow_id\": \"FLOW_ID\",
    \"caller_number\": \"+905551112233\",
    \"destination_number\": \"+902122223344\"
  }"
```

Expected first action:

```json
{
  "data": {
    "session": {
      "status": "running",
      "current_node_id": "welcome"
    },
    "action": {
      "action": "play_prompt"
    }
  }
}
```

## 7. Advance Runtime Session

Prompt completed:

```bash
curl -X POST http://localhost:3000/api/v1/runtime/ivr/sessions/SESSION_ID/advance \
  -H "Authorization: Bearer change-me-runtime-token" \
  -H "Content-Type: application/json" \
  -d '{
    "node_id": "welcome",
    "outcome": "completed"
  }'
```

Menu digits collected:

```bash
curl -X POST http://localhost:3000/api/v1/runtime/ivr/sessions/SESSION_ID/advance \
  -H "Authorization: Bearer change-me-runtime-token" \
  -H "Content-Type: application/json" \
  -d '{
    "node_id": "menu",
    "outcome": "digits",
    "digits": "1"
  }'
```

Expected action after digit `1`:

```json
{
  "data": {
    "action": {
      "action": "transfer",
      "target_type": "extension",
      "target": "200"
    }
  }
}
```

## Proof Criteria

This slice is proven when:

- prompt assets can be created and listed
- IVR validation rejects missing prompt references
- a published flow can start a runtime session
- the backend resolves `start`, `play_prompt`, `play_collect`, `switch`, and `transfer_extension`
- the runtime session keeps a pinned `flow_version_id`
