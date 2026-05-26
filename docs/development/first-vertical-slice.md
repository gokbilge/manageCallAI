# First Vertical Slice

This guide proves the MVP path from a fresh checkout:

1. register a tenant
2. create an extension
3. store the SIP secret encrypted at rest
4. look up the extension through the FreeSWITCH directory endpoint
5. optionally start the stock FreeSWITCH reference container

## 1. Prepare the Environment

```bash
cp .env.example .env
pnpm install
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
pnpm install
```

Verify these values in `.env`:

- `DATABASE_URL`
- `JWT_SECRET`
- `RUNTIME_API_TOKEN`
- `SIP_SECRET_MASTER_KEY`
- `SIP_SECRET_KEY_ID`

`Authorization: Bearer <RUNTIME_API_TOKEN>` is the preferred runtime auth format.
The `runtime_token` query/body fallback exists only for local development and constrained `mod_xml_curl` setups.

## 2. Start PostgreSQL and Run Migrations

```bash
pnpm db:up
pnpm db:migrate
```

## 3. Start the API

```bash
pnpm --filter @managecallai/api dev
```

Health check:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{"status":"ok","db":"ok"}
```

## 4. Register a Tenant

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_name": "Acme Demo",
    "tenant_slug": "acme-demo",
    "email": "owner@acme-demo.local",
    "display_name": "Owner",
    "password": "Secret123!"
  }'
```

Expected behavior:

- returns `201`
- returns a JWT token
- creates tenant domain `acme-demo.managecallai.local`

Save the returned JWT as `JWT`.

## 5. Create an Extension

```bash
curl -X POST http://localhost:3000/api/v1/extensions \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "extension_number": "200",
    "display_name": "Reception",
    "sip_password": "PhonePass123!"
  }'
```

Expected behavior:

- returns `201`
- response includes `sip_username`
- response does not include `sip_password`
- response does not include `sip_password_ciphertext`

## 6. Call the FreeSWITCH Directory Endpoint

Preferred header-based auth:

```bash
curl "http://localhost:3000/api/v1/freeswitch/directory?user=200&domain=acme-demo.managecallai.local" \
  -H "Authorization: Bearer <RUNTIME_API_TOKEN>"
```

Local compatibility form:

```bash
curl "http://localhost:3000/api/v1/freeswitch/directory?runtime_token=<RUNTIME_API_TOKEN>&user=200&domain=acme-demo.managecallai.local"
```

Expected behavior:

- returns `200`
- returns FreeSWITCH XML
- XML contains:
  - `<domain name="acme-demo.managecallai.local">`
  - `<user id="200">`
  - `<param name="password" value="PhonePass123!" />`

## 7. Optional: Start the Stock FreeSWITCH Reference Container

```bash
docker compose build freeswitch
docker compose up -d freeswitch
```

Quick checks:

```bash
docker exec managecallai-freeswitch-1 /bin/sh -lc "/usr/local/freeswitch/bin/fs_cli -x 'module_exists mod_event_socket'"
docker exec managecallai-freeswitch-1 /bin/sh -lc "/usr/local/freeswitch/bin/fs_cli -x 'module_exists mod_xml_curl'"
```

Expected result for both:

```text
true
```
