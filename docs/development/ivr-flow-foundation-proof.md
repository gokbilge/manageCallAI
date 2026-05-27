# IVR Flow Foundation Proof

> Execution guide only.
> Canonical architecture, scope boundaries, and design decisions live in [../architecture/source-of-truth.md](../architecture/source-of-truth.md).
> If this runbook conflicts with architecture docs, the source-of-truth document wins.

This guide proves the first IVR desired-state foundation without needing live FreeSWITCH call execution.

It covers:

1. register a tenant
2. create an extension
3. create an IVR flow draft
4. list versions
5. validate the draft
6. simulate the draft
7. publish immediately or observe approval-pending behavior
8. inspect the result in the tenant web UI

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

Optional web UI:

```bash
pnpm --filter @managecallai/web dev
```

## 2. Register a Tenant

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_name": "Acme IVR Demo",
    "tenant_slug": "acme-ivr-demo",
    "email": "owner@acme-ivr-demo.local",
    "display_name": "Owner",
    "password": "Secret123!"
  }'
```

Save the returned JWT as `JWT`.

## 3. Create an Extension Target

```bash
curl -X POST http://localhost:3000/api/v1/extensions \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "extension_number": "201",
    "display_name": "Support",
    "sip_password": "PhonePass123!"
  }'
```

Save the returned `id` as `EXTENSION_ID`.

## 4. Create an IVR Flow Draft

```bash
curl -X POST http://localhost:3000/api/v1/ivr-flows \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Menu",
    "description": "First desired-state IVR draft",
    "graph_json": {
      "entry_node_id": "start",
      "nodes": [
        {
          "id": "start",
          "type": "start",
          "next_node_id": "welcome"
        },
        {
          "id": "welcome",
          "type": "play_collect",
          "prompt_id": "welcome_tr",
          "max_digits": 1,
          "timeout_ms": 5000,
          "retries": 2,
          "next_node_id": "route_digit",
          "timeout_node_id": "end",
          "invalid_node_id": "end"
        },
        {
          "id": "route_digit",
          "type": "switch",
          "cases": {
            "2": "support"
          },
          "default_node_id": "end"
        },
        {
          "id": "support",
          "type": "transfer_extension",
          "extension_id": "<EXTENSION_ID>"
        },
        {
          "id": "end",
          "type": "hangup"
        }
      ]
    }
  }'
```

Expected behavior:

- returns `201`
- returns flow metadata plus the initial draft version
- `draft_version_id` is set

Save:

- `FLOW_ID`
- `VERSION_ID`

## 5. List Versions

```bash
curl http://localhost:3000/api/v1/ivr-flows/<FLOW_ID>/versions \
  -H "Authorization: Bearer <JWT>"
```

Expected behavior:

- returns `{ "data": [...] }`
- includes the initial draft version

## 6. Validate the Draft

Current MVP foundation supports structural validation only.

Validate the current draft:

```bash
curl -X POST http://localhost:3000/api/v1/ivr-flows/<FLOW_ID>/validate \
  -H "Authorization: Bearer <JWT>"
```

Or validate a specific version:

```bash
curl -X POST http://localhost:3000/api/v1/ivr-flows/<FLOW_ID>/versions/<VERSION_ID>/validate \
  -H "Authorization: Bearer <JWT>"
```

Expected behavior:

- `200` when structural validation passes
- `422` when structural validation fails
- response shape:

```json
{
  "data": {
    "version": {
      "id": "..."
    },
    "outcome": {
      "status": "passed",
      "errors": [],
      "warnings": []
    }
  }
}
```

## 7. Simulate the Draft

```bash
curl -X POST http://localhost:3000/api/v1/ivr-flows/<FLOW_ID>/simulate \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "digits": ["2"],
    "caller_number": "+905551112233"
  }'
```

Expected behavior:

- `200` when the simulated path completes cleanly
- `422` when the graph is structurally valid but cannot complete the requested runtime path
- response includes `path`, `final_action`, and any simulation errors

## 8. Publish the Version

```bash
curl -X POST http://localhost:3000/api/v1/ivr-flows/<FLOW_ID>/versions/<VERSION_ID>/publish \
  -H "Authorization: Bearer <JWT>"
```

Expected behavior:

- `200` with `{ "data": { "status": "published", "flow": { ... } } }` when no approval is required
- `202` with `{ "data": { "status": "pending_approval", "approval_request_id": "...", "flow": { ... } } }` when tenant policy requires approval

## 9. Optional UI Proof

With the web app running:

1. log in at `/auth`
2. open `/tenant/ivr-flows`
3. create a flow
4. open `/tenant/ivr-flows/:flowId`
5. review versions and raw `graph_json`
6. run `Validate Draft`
7. run `Simulate Draft`
8. observe publish status or pending approval state

Current boundary:

- no visual builder yet
- no runtime execution yet
- simulation remains deterministic preview only, not live call execution
- approval requests are created, but approval decision endpoints are still a later slice

This slice proves the desired-state IVR foundation only.
