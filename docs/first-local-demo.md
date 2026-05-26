# First Local Demo

This is the shortest path to proving the first local `manageCallAI` slice.

## 1. Start PostgreSQL

```bash
pnpm db:up
pnpm db:migrate
```

## 2. Start the API

```bash
pnpm --filter @managecallai/api dev
```

Required env values come from `.env` or `.env.example`.

At minimum, set:

- `DATABASE_URL`
- `JWT_SECRET`
- `RUNTIME_API_TOKEN`
- `SIP_SECRET_MASTER_KEY` — 64 hex chars (32 bytes). Generate with `openssl rand -hex 32`.
- `SIP_SECRET_KEY_ID` — any short label, e.g. `v1`

The `.env.example` contains safe dev defaults for all of these.

## 3. Register a Tenant

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

The tenant domain for this example becomes:

```text
acme-demo.managecallai.local
```

Save the returned JWT token.

## 4. Create an Extension

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

The extension SIP username defaults to the extension number unless you set `sip_username`.
`sip_password` is accepted as plaintext and encrypted before storage — it is never returned by the API.

## 5. Call the FreeSWITCH Directory Endpoint

```bash
curl "http://localhost:3000/api/v1/freeswitch/directory?runtime_token=<RUNTIME_API_TOKEN>&user=200&domain=acme-demo.managecallai.local"
```

Expected result:

- HTTP `200`
- XML directory response
- `<param name="password" value="PhonePass123!" />` (decrypted only at this point)
- `managecall_extension_id` in the returned variables
