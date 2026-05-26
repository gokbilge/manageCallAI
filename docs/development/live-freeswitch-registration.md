# Live FreeSWITCH Registration Smoke Test

This guide proves the runtime path that goes beyond the API-only vertical slice:

1. start PostgreSQL
2. start the API
3. start stock FreeSWITCH
4. create a tenant and extension
5. run the Go ESL agent
6. register a SIP endpoint against FreeSWITCH
7. confirm the registration event appears through the API

## Prerequisites

- `.env` copied from `.env.example`
- `RUNTIME_API_TOKEN` set consistently for API, FreeSWITCH, and agent
- `SIP_SECRET_MASTER_KEY` and `SIP_SECRET_KEY_ID` configured
- Node.js available to run the SIP REGISTER smoke script

## Start Base Services

```powershell
pnpm db:up
pnpm db:migrate
pnpm --filter @managecallai/api build
node apps/api/dist/server.js
docker compose up -d freeswitch
```

The FreeSWITCH container renders `xml_curl.conf.xml` and `event_socket.conf.xml` from env at startup.
By default it points directory lookups at:

```text
http://api:3000/api/v1/freeswitch/directory
```

inside Compose, with `runtime_token` attached from `RUNTIME_API_TOKEN`.

## Create Tenant and Extension

Register a tenant and save the returned JWT:

```powershell
$register = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/v1/auth/register' `
  -ContentType 'application/json' `
  -Body (@{
    tenant_name = 'Acme Live'
    tenant_slug = 'acme-live'
    email = 'owner@acme-live.local'
    display_name = 'Owner'
    password = 'Secret123!'
  } | ConvertTo-Json)

$jwt = $register.token
```

Create an extension:

```powershell
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/v1/extensions' `
  -Headers @{ Authorization = "Bearer $jwt" } `
  -ContentType 'application/json' `
  -Body (@{
    extension_number = '200'
    display_name = 'Reception'
    sip_password = 'PhonePass123!'
  } | ConvertTo-Json)
```

The tenant domain is:

```text
acme-live.managecallai.local
```

## Start the Go Agent

Set the tenant UUID to the value from the register token payload or the created extension response.

```powershell
$env:FREESWITCH_ESL_HOST='127.0.0.1'
$env:FREESWITCH_ESL_PORT='8021'
$env:FREESWITCH_ESL_PASSWORD='ClueCon'
$env:MANAGECALLAI_TENANT_ID='<tenant-uuid>'
$env:RUNTIME_API_TOKEN=$env:RUNTIME_API_TOKEN
$env:API_BASE_URL='http://localhost:3000'
go run .\apps\freeswitch-agent
```

## Send a Real SIP REGISTER

Run the smoke script:

```powershell
$env:SIP_HOST='127.0.0.1'
$env:SIP_PORT='5080'
$env:SIP_USERNAME='200'
$env:SIP_PASSWORD='PhonePass123!'
$env:SIP_DOMAIN='acme-live.managecallai.local'
node .\scripts\sip-register-smoke.mjs
```

Expected result:

- first response is `401 Unauthorized`
- second response is `200 OK`

## Verify the Registration Event

List call events:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/call-events?tenant_id=<tenant-uuid>" `
  -Headers @{ Authorization = "Bearer $jwt" }
```

Expected result:

- at least one event with `event_type = registration_seen`
- `source = freeswitch-esl`
- payload contains `Event-Subclass = sofia::register`
