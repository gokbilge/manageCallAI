# Live FreeSWITCH Registration Smoke Test

> Execution guide only.
> Canonical architecture, scope boundaries, and design decisions live in [../architecture/source-of-truth.md](../architecture/source-of-truth.md).
> If this runbook conflicts with architecture docs, the source-of-truth document wins.

This guide proves the full runtime slice against stock FreeSWITCH:

1. start PostgreSQL
2. run migrations
3. start the API container
4. create a tenant and extension
5. start stock FreeSWITCH
6. start the Go ESL agent container
7. register a SIP endpoint against FreeSWITCH
8. confirm the registration event is stored through the API

This is the currently verified local path.

## Prerequisites

- `.env` copied from `.env.example`
- `RUNTIME_API_TOKEN` set consistently for API, FreeSWITCH, and agent
- `SIP_SECRET_MASTER_KEY` and `SIP_SECRET_KEY_ID` configured
- Node.js available to run the SIP REGISTER smoke script

Recommended `.env` values for local runtime proof:

```dotenv
RUNTIME_API_TOKEN=dev-runtime-token-change-in-production
FREESWITCH_ESL_PASSWORD=ClueCon
SIP_SECRET_KEY_ID=v1
```

## 1. Start PostgreSQL and Run Migrations

```powershell
pnpm db:up
pnpm db:migrate
```

## 2. Start the API Container

```powershell
docker compose up -d --build api
```

Health check:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Expected:

```json
{"status":"ok","db":"ok"}
```

## 3. Register a Tenant and Create an Extension

Register a tenant and save the JWT:

```powershell
$register = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/v1/auth/register' `
  -ContentType 'application/json' `
  -Body (@{
    tenant_name = 'Live E2E'
    tenant_slug = 'live-e2e'
    email = 'owner@live-e2e.local'
    display_name = 'Owner'
    password = 'Secret123!'
  } | ConvertTo-Json)

$jwt = $register.token
```

Create an extension:

```powershell
$extension = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/v1/extensions' `
  -Headers @{ Authorization = "Bearer $jwt" } `
  -ContentType 'application/json' `
  -Body (@{
    extension_number = '200'
    display_name = 'Reception'
    sip_password = 'PhonePass123!'
  } | ConvertTo-Json)
```

Tenant domain pattern:

```text
<tenant_slug>.managecallai.local
```

For the example above, the runtime SIP domain is:

```text
live-e2e.managecallai.local
```

Capture the tenant ID for the agent:

```powershell
$tenantId = $extension.data.tenant_id
```

## 4. Start FreeSWITCH and the ESL Agent

FreeSWITCH and the agent run under the `freeswitch` compose profile.
The first run triggers a source build (10–25 minutes). See
[freeswitch-runtime.md](freeswitch-runtime.md) for details.

```powershell
$env:MANAGECALLAI_TENANT_ID = $tenantId
docker compose --profile freeswitch up -d --build
```

Or build just FreeSWITCH first, then bring everything up:

```powershell
docker compose --profile freeswitch build freeswitch
$env:MANAGECALLAI_TENANT_ID = $tenantId
docker compose --profile freeswitch up -d
```

Verify both runtime services:

```powershell
docker compose ps
docker logs managecallai-freeswitch-agent-1 --tail 20
```

Expected agent log lines:

- `authenticated to esl`
- `esl subscription active`

## 5. Run a Real SIP REGISTER

Use the included smoke client:

```powershell
$env:SIP_HOST='127.0.0.1'
$env:SIP_PORT='5080'
$env:SIP_USERNAME='200'
$env:SIP_PASSWORD='PhonePass123!'
$env:SIP_DOMAIN='live-e2e.managecallai.local'
node .\scripts\sip-register-smoke.mjs
```

Expected result:

- first response is `401 Unauthorized`
- second response is `200 OK`
- script prints `REGISTER succeeded.`

## 6. Verify FreeSWITCH Registration State

```powershell
docker exec managecallai-freeswitch-1 /bin/sh -lc "/usr/local/freeswitch/bin/fs_cli -x 'sofia status profile external reg'"
```

Expected result:

- registration exists for `200@live-e2e.managecallai.local`
- status shows `Registered(UDP)`

## 7. Verify Event Ingestion Through the API

Inspect the agent log:

```powershell
docker logs managecallai-freeswitch-agent-1 --tail 50
```

Expected line:

- `received normalized esl event` with `event_type=registration_seen`

List call events through the API:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/call-events?tenant_id=$tenantId" `
  -Headers @{ Authorization = "Bearer $jwt" }
```

Expected result:

- at least one event with `event_type = registration_seen`
- `source = freeswitch-esl`
- payload includes `Event-Subclass = sofia::register`

Optional DB confirmation:

```powershell
docker exec managecallai-postgres-1 psql -U managecallai -d managecallai -c "select event_type, call_id, source, event_time from call_events order by ingested_at desc limit 5;"
```

## Notes

- The clean local proof now uses the containerized `freeswitch-agent` service, not a long-running Windows host process.
- `mod_xml_curl` is configured to call the API with uppercase `POST`.
- The SIP smoke client preserves a stable `From` tag across REGISTER challenge and retry, which is required for a valid authenticated registration flow.
