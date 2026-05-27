# Admin Surface Proof

> Execution guide only.
> Canonical architecture and scope decisions live in [../architecture/source-of-truth.md](../architecture/source-of-truth.md).
> If this runbook conflicts with architecture docs, the source-of-truth document wins.

This guide proves the tenant operator surfaces for phone numbers and inbound routes.
No raw API calls are needed once the UI is running — this doc verifies both
the API contract and the web UI flow.

## 1. Prepare the Environment

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:migrate
```

Start the API:

```bash
pnpm --filter @managecallai/api dev
```

Start the web UI:

```bash
pnpm --filter @managecallai/web dev
```

## 2. Register a Tenant and Obtain a JWT

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_name": "Acme Routing Demo",
    "tenant_slug": "acme-routing-demo",
    "email": "owner@acme.local",
    "display_name": "Owner",
    "password": "Secret123!"
  }'
```

Save the returned token as `JWT`.

## 3. Phone Numbers

### 3a. Create a DID

```bash
curl -s -X POST http://localhost:3000/api/v1/phone-numbers \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "e164_number": "+905551234567",
    "display_label": "Main sales line"
  }'
```

Expected: `201`, body `{ "data": { "id": "...", "status": "active", ... } }`.

Save `PHONE_NUMBER_ID`.

### 3b. List Numbers

```bash
curl -s http://localhost:3000/api/v1/phone-numbers \
  -H "Authorization: Bearer $JWT"
```

Expected: array containing the created DID.

### 3c. Deactivate

```bash
curl -s -X POST http://localhost:3000/api/v1/phone-numbers/$PHONE_NUMBER_ID/deactivate \
  -H "Authorization: Bearer $JWT"
```

Expected: `200`, `status: "inactive"`.

## 4. Extensions (required for inbound route target)

```bash
curl -s -X POST http://localhost:3000/api/v1/extensions \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "extension_number": "200",
    "display_name": "Reception",
    "sip_password": "PhonePass123!"
  }'
```

Save `EXTENSION_ID`.

## 5. Inbound Routes

### 5a. Create a Route

```bash
curl -s -X POST http://localhost:3000/api/v1/inbound-routes \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main line to reception",
    "match_type": "did",
    "match_value": "+905551234567",
    "target_type": "extension",
    "target_id": "'$EXTENSION_ID'"
  }'
```

Expected: `201`, route in `draft` status.

Save `ROUTE_ID`.

### 5b. Activate the Route

A route in draft or inactive state is not projected to FreeSWITCH dialplan.
Activation makes the route live.

```bash
curl -s -X POST http://localhost:3000/api/v1/inbound-routes/$ROUTE_ID/activate \
  -H "Authorization: Bearer $JWT"
```

Expected: `200`, `status: "active"`.

### 5c. Test Dialplan Projection

With FreeSWITCH running and mod_xml_curl configured, FreeSWITCH will call the
dialplan endpoint. To verify the response manually:

```bash
curl -s -X POST "http://localhost:3000/api/v1/freeswitch/dialplan" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "destination_number=%2B905551234567&domain=acme-routing-demo"
```

Expected: XML with `<action application="transfer" data="200 XML default"/>`.

### 5d. Deactivate

```bash
curl -s -X POST http://localhost:3000/api/v1/inbound-routes/$ROUTE_ID/deactivate \
  -H "Authorization: Bearer $JWT"
```

Expected: `200`, `status: "inactive"`.

## 6. Web UI Proof

With the web app running at `http://localhost:5173`:

1. Log in at `/auth`
2. Open `/tenant/numbers`
   - Creates a DID using the form (E.164 format, optional label)
   - Table shows status badge; Deactivate button appears for active numbers
   - Empty state visible before first number is created
3. Open `/tenant/routes/inbound`
   - Create a route: pick a name, DID (match value), and target extension from dropdown
   - Table shows status badge; Activate/Deactivate buttons update state inline
   - Extension dropdown is populated from the live extensions list
   - Warning shown when no active extensions exist

## 7. Current Boundaries

- No visual IVR builder (SLICE-08)
- Route target is `extension` only; `flow` target requires IVR runtime resolver (SLICE-04)
- Approval decision UI is a separate slice (SLICE-02)
- Prompt asset management requires SLICE-03 first
