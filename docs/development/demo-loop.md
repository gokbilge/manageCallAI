# Demo Loop

End-to-end walk-through that proves the full system in one sitting.

Two levels of proof are available:

| Level | What it covers | FreeSWITCH required? |
|-------|---------------|----------------------|
| **API proof** | auth, extension CRUD, directory endpoint, call-event ingest + query | No |
| **Runtime proof** | everything above + real SIP REGISTER from a soft client | Yes (10–25 min build) |

Start with the API proof. Add the runtime proof once you need to verify the
FreeSWITCH integration layer.

---

## Prerequisites

```powershell
cp .env.example .env
```

Required `.env` values for local demo:

```dotenv
RUNTIME_API_TOKEN=dev-runtime-token-change-in-production
FREESWITCH_ESL_PASSWORD=ClueCon
SIP_SECRET_KEY_ID=v1
```

`SIP_SECRET_MASTER_KEY` must be a 64-character hex string. Generate one with:

```powershell
-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
```

---

## Part 1 — API Proof (no FreeSWITCH needed)

### 1. Start the database and run migrations

```powershell
pnpm db:up
pnpm db:migrate
```

### 2. Start the API

```powershell
pnpm dev:api
```

Health check:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Expected: `{ "status": "ok", "db": "ok" }`

### 3. Register a tenant and save the JWT

```powershell
$reg = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/auth/register `
  -ContentType application/json `
  -Body (@{
    tenant_name  = 'Acme Demo'
    tenant_slug  = 'acme-demo'
    email        = 'admin@acme-demo.local'
    display_name = 'Demo Admin'
    password     = 'Secret123!'
  } | ConvertTo-Json)

$jwt = $reg.token
```

### 4. Create an extension

```powershell
$ext = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/extensions `
  -Headers @{ Authorization = "Bearer $jwt" } `
  -ContentType application/json `
  -Body (@{
    extension_number = '200'
    display_name     = 'Reception'
    sip_password     = 'PhonePass123!'
  } | ConvertTo-Json)

$tenantId   = $ext.data.tenant_id
$extId      = $ext.data.id
```

### 5. Verify the FreeSWITCH directory endpoint

```powershell
$dir = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/v1/freeswitch/directory?domain=acme-demo.managecallai.local&user=200" `
  -Headers @{ Authorization = "Bearer dev-runtime-token-change-in-production" }
```

Expected: XML response containing `sip_auth_password` inside a `<param>` element.

### 6. Ingest a call event (runtime token)

```powershell
$ingest = Invoke-RestMethod -Method Post `
  -Uri http://localhost:3000/api/v1/call-events/internal/ingest `
  -Headers @{ Authorization = "Bearer dev-runtime-token-change-in-production" } `
  -ContentType application/json `
  -Body (@{
    tenant_id  = $tenantId
    event_type = 'registration_seen'
    call_id    = 'demo-call-1'
    source     = 'demo'
    payload    = @{ note = 'manual demo event' }
  } | ConvertTo-Json)

$ingest.data.id   # should be a UUID
```

### 7. Query call events (user JWT)

```powershell
$events = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/v1/call-events?tenant_id=$tenantId" `
  -Headers @{ Authorization = "Bearer $jwt" }

$events.data.Count   # should be >= 1
$events.data[0].event_type   # registration_seen
```

**API proof complete.**

### 8. Optional: Create the First IVR Flow Draft

You can extend the API proof with the first IVR desired-state foundation:

1. create an extension target
2. create `/api/v1/ivr-flows`
3. list `/api/v1/ivr-flows/:flowId/versions`
4. validate `/api/v1/ivr-flows/:flowId/validate`

Full command-driven walkthrough:

- [ivr-flow-foundation-proof.md](ivr-flow-foundation-proof.md)

---

## Part 2 — Runtime Proof (real SIP REGISTER)

Extends Part 1. Run everything in Part 1 first.

> First run builds FreeSWITCH from source — allow **10–25 minutes**.
> See [freeswitch-runtime.md](freeswitch-runtime.md) for details.

Full step-by-step instructions including SIP REGISTER verification are in
[live-freeswitch-registration.md](live-freeswitch-registration.md).

Quick start once Part 1 is done:

```powershell
$env:MANAGECALLAI_TENANT_ID = $tenantId
pnpm runtime:up
```

Wait for the agent to log:
```
authenticated to esl
esl subscription active
```

Then run the SIP smoke client:

```powershell
$env:SIP_HOST     = '127.0.0.1'
$env:SIP_PORT     = '5080'
$env:SIP_USERNAME = '200'
$env:SIP_PASSWORD = 'PhonePass123!'
$env:SIP_DOMAIN   = 'acme-demo.managecallai.local'
node .\scripts\sip-register-smoke.mjs
```

Expected: `REGISTER succeeded.`

Verify the event was persisted:

```powershell
$events = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/v1/call-events?tenant_id=$tenantId" `
  -Headers @{ Authorization = "Bearer $jwt" }

$events.data | Where-Object { $_.event_type -eq 'registration_seen' }
```

Tear down the runtime profile:

```powershell
pnpm runtime:down
```

---

## Troubleshooting

**`db:migrate` fails — no database**
Run `pnpm db:up` first. If the container already exists, check `docker ps`.

**`dev:api` fails — missing env vars**
Ensure `.env` has `SIP_SECRET_MASTER_KEY` (64-char hex) and `SIP_SECRET_KEY_ID`.

**Directory endpoint returns 404**
The tenant slug in the domain param must match exactly. For slug `acme-demo` the
domain is `acme-demo.managecallai.local`.

**FreeSWITCH can't reach the API**
Both must be on the same Docker network. Check `MANAGECALLAI_DIRECTORY_URL` in
`.env` — it should point to `http://api:3000/...` (Docker service name, not
`localhost`). See [freeswitch-runtime.md](freeswitch-runtime.md#troubleshooting).

**ESL agent won't connect**
`FREESWITCH_ESL_PASSWORD` must match in both FreeSWITCH config and agent env.
Default is `ClueCon`.
