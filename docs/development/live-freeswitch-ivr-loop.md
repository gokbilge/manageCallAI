# Live FreeSWITCH IVR Loop Proof

> Execution guide only.
> Canonical architecture, scope boundaries, and design decisions live in [../architecture/source-of-truth.md](../architecture/source-of-truth.md).
> If this runbook conflicts with architecture docs, the source-of-truth document wins.

This guide proves the first live IVR runtime loop on stock FreeSWITCH:

1. create a prompt asset
2. create and publish an IVR flow
3. bind an inbound DID route to that flow
4. let FreeSWITCH enter the Lua helper
5. let Lua call the backend runtime resolver
6. execute `play_collect -> switch -> transfer`

## Prerequisites

- `.env` copied from `.env.example`
- runtime prerequisites from [live-freeswitch-registration.md](live-freeswitch-registration.md)
- a reachable prompt file path for FreeSWITCH such as `/usr/local/freeswitch/sounds/demo_ivr_welcome.wav`

## 1. Bring up the core stack

```powershell
pnpm db:up
pnpm db:migrate
docker compose up -d --build api
```

Register a tenant and save the JWT:

```powershell
$reg = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/auth/register `
  -ContentType application/json `
  -Body (@{
    tenant_name  = 'IVR Demo'
    tenant_slug  = 'ivr-demo'
    email        = 'owner@ivr-demo.local'
    display_name = 'IVR Owner'
    password     = 'Secret123!'
  } | ConvertTo-Json)

$jwt = $reg.token
```

## 2. Create the transfer target extension

```powershell
$extension = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/extensions `
  -Headers @{ Authorization = "Bearer $jwt" } `
  -ContentType application/json `
  -Body (@{
    extension_number = '200'
    display_name     = 'Sales'
    sip_password     = 'PhonePass123!'
  } | ConvertTo-Json)

$tenantId = $extension.data.tenant_id
$extensionId = $extension.data.id
```

## 3. Create a prompt asset

For the first proof, point `storage_uri` at a file FreeSWITCH can already play.

```powershell
$prompt = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/prompts `
  -Headers @{ Authorization = "Bearer $jwt" } `
  -ContentType application/json `
  -Body (@{
    name        = 'demo_ivr_welcome'
    media_type  = 'audio/wav'
    language    = 'en-US'
    storage_uri = '/usr/local/freeswitch/sounds/demo_ivr_welcome.wav'
  } | ConvertTo-Json)

$promptId = $prompt.data.id
```

## 4. Create, validate, and publish an IVR flow

```powershell
$flow = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/ivr-flows `
  -Headers @{ Authorization = "Bearer $jwt" } `
  -ContentType application/json `
  -Body (@{
    name = 'Inbound Main IVR'
    graph_json = @{
      entry_node_id = 'start'
      nodes = @(
        @{ id = 'start'; type = 'start'; next_node_id = 'menu' },
        @{
          id = 'menu'
          type = 'play_collect'
          prompt_id = $promptId
          max_digits = 1
          timeout_ms = 5000
          retries = 0
          next_node_id = 'route_digit'
          timeout_node_id = 'hangup'
          invalid_node_id = 'hangup'
        },
        @{
          id = 'route_digit'
          type = 'switch'
          input = '{{last_digits}}'
          cases = @{ '1' = 'sales' }
          default_node_id = 'hangup'
        },
        @{ id = 'sales'; type = 'transfer_extension'; extension_id = $extensionId },
        @{ id = 'hangup'; type = 'hangup' }
      )
    }
  } | ConvertTo-Json -Depth 8)

$flowId = $flow.data.id
$versionId = $flow.data.versions[0].id
```

Validate and publish:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/v1/ivr-flows/$flowId/versions/$versionId/validate" `
  -Headers @{ Authorization = "Bearer $jwt" }

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/v1/ivr-flows/$flowId/versions/$versionId/publish" `
  -Headers @{ Authorization = "Bearer $jwt" }
```

## 5. Create the DID and inbound route

```powershell
$number = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/phone-numbers `
  -Headers @{ Authorization = "Bearer $jwt" } `
  -ContentType application/json `
  -Body (@{
    e164_number = '+15551230001'
  } | ConvertTo-Json)

$phoneNumberId = $number.data.id
```

```powershell
$route = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/inbound-routes `
  -Headers @{ Authorization = "Bearer $jwt" } `
  -ContentType application/json `
  -Body (@{
    name = 'Inbound IVR Route'
    match_type = 'did'
    match_value = '+15551230001'
    phone_number_id = $phoneNumberId
    target_type = 'flow'
    target_id = $flowId
  } | ConvertTo-Json)

$routeId = $route.data.id
$routeVersionId = $route.data.versions[0].id
```

Validate and publish the route:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/v1/inbound-routes/$routeId/versions/$routeVersionId/validate" `
  -Headers @{ Authorization = "Bearer $jwt" }

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/v1/inbound-routes/$routeId/versions/$routeVersionId/publish" `
  -Headers @{ Authorization = "Bearer $jwt" }
```

## 6. Start FreeSWITCH and the agent

```powershell
$env:MANAGECALLAI_TENANT_ID = $tenantId
docker compose --profile freeswitch up -d --build
```

## 7. Prove the DID resolves to a flow target

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/v1/freeswitch/route-lookup?did=%2B15551230001" `
  -Headers @{ Authorization = "Bearer $env:RUNTIME_API_TOKEN" }
```

Expected:

- `matched = true`
- `target_type = flow`
- `target_id = $flowId`

## 8. Trigger the runtime loop through FreeSWITCH

Use your SIP/DID test path so the inbound call lands on `+15551230001`.

The expected call path is:

1. `inbound_route.lua` resolves the DID to the published flow
2. `managecall_entry.lua` starts `/api/v1/runtime/ivr/sessions`
3. backend returns `play_collect`
4. caller presses `1`
5. Lua advances the runtime session
6. backend resolves `switch -> transfer_extension`
7. Lua bridges to extension `200`

## 9. Verify runtime session state

Inspect the API runtime behavior:

```powershell
docker logs managecallai-api-1 --tail 100
```

Expected API calls:

- `POST /api/v1/runtime/ivr/sessions`
- `POST /api/v1/runtime/ivr/sessions/<session-id>/advance`

Inspect FreeSWITCH logs:

```powershell
docker logs managecallai-freeswitch-1 --tail 100
```

Expected log messages:

- `starting IVR runtime loop for flow ...`
- `executing play_collect node menu`
- `executing transfer node sales`

## Proof criteria

This slice is proven when:

- inbound DID lookup resolves to a published flow target
- FreeSWITCH enters the Lua helper instead of hanging up
- the Lua helper starts and advances backend runtime sessions
- a `play_collect -> switch -> transfer_extension` path completes on a live call
