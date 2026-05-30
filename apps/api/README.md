# @managecallai/api

Node.js + TypeScript REST API — the control plane for manageCallAI.

## Stack

| Choice | Reason |
|--------|--------|
| **Fastify v5** | Plugin-based, schema-validated routes, fast |
| **fastify-type-provider-zod** | Zod schemas from `@managecallai/contracts` as validators |
| **pg (node-postgres)** | Raw SQL + connection pool; no ORM |
| **tsx** | Fast TS runner with `--watch` |
| **vitest** | ESM-native test runner |

## Structure

```
src/
  config/env.ts               Environment variable validation
  db/client.ts                pg Pool singleton
  errors/                     Global error handler + RPC error helpers
  modules/
    auth/                     Register / login, JWT signing
    extensions/               SIP extension CRUD
    sip-trunks/               SIP trunk CRUD
    phone-numbers/            Phone number management
    prompts/                  Prompt asset metadata
    call-groups/              Call group + member management
    queues/                   Queue + member management
    voicemail-boxes/          Voicemail box management
    schedules/                Business hours schedule management
    outbound-routes/          Outbound route + resolution
    inbound-routes/           Inbound route lifecycle (draft → publish)
    ivr-flows/                IVR flow lifecycle (draft → simulate → publish)
    runtime/                  IVR session start/advance; outbound call dispatch
    approvals/                Approval gating for publish operations
    automation/               API keys + webhook subscriptions
    webhooks/                 Webhook delivery history/queue status
    call-events/              Call event ingestion + tenant query
    recordings/               Recording metadata + analysis requests
    users/                    Tenant user management
    audit/                    Audit log read access
    export/                   Tenant data export
    provider-work/            TTS generation + IVR AI turn contracts
    channel-accounts/         Messaging/meeting channel accounts
    channel-messages/         Inbound/outbound message handling
    meeting-sessions/         Meeting session lifecycle
    platform/                 Platform operator endpoints
    freeswitch/               mod_xml_curl directory + dialplan endpoints
  health/health.controller.ts GET /health
  app.ts                      Fastify factory — plugins, type provider, route prefixes
  server.ts                   Entry point — binds to API_PORT
```

## Prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL 17

```sh
# from repo root
cp .env.example .env
docker compose up postgres -d
pnpm db:migrate
```

## Running locally

```sh
pnpm install                          # from repo root
pnpm --filter @managecallai/api dev   # starts on API_PORT (default 3000)
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://managecallai:managecallai@localhost:5432/managecallai` | PostgreSQL connection string |
| `API_PORT` | `3000` | HTTP listen port |
| `APP_ENV` | `development` | Set to `production` to enforce production secret checks and header-only runtime auth by default |
| `JWT_SECRET` | — | Required; used to sign/verify JWTs |
| `RUNTIME_API_TOKEN` | — | Bearer token for FreeSWITCH runtime endpoints |
| `ALLOW_RUNTIME_TOKEN_FALLBACK` | `true` outside production, `false` in production | Allows legacy `runtime_token` query/body compatibility for local-only setups. Production FreeSWITCH `mod_xml_curl` should use HTTP Basic Auth with the runtime token as the password. |
| `SIP_SECRET_MASTER_KEY` | — | 64-char hex; AES-256-GCM key for SIP password encryption |
| `SIP_SECRET_KEY_ID` | — | Key version label (e.g. `v1`) |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window for protected edge surfaces |
| `RATE_LIMIT_AUTH_MAX` | `100` | Requests per window for `/api/v1/auth/*` per client key |
| `RATE_LIMIT_RUNTIME_MAX` | `1200` | Requests per window for runtime and FreeSWITCH endpoints per client key |
| `RATE_LIMIT_WEBHOOK_MAX` | `300` | Requests per window for webhook management endpoints per client key |
| `RATE_LIMIT_OUTBOUND_MAX` | `60` | Requests per window for outbound call initiation per client key |

## Auth model

- **Tenant endpoints**: `Authorization: Bearer <JWT>` (issued by `/api/v1/auth/login`)
- **Runtime/FreeSWITCH endpoints**: `Authorization: Bearer <RUNTIME_API_TOKEN>` or `x-managecallai-runtime-token: <token>`

When `APP_ENV=production`, startup rejects the sample `JWT_SECRET`, `RUNTIME_API_TOKEN`, and `SIP_SECRET_MASTER_KEY` values from local examples. Runtime query/body token fallback is disabled by default in production; use headers unless a deployment has an explicitly isolated compatibility path.

Auth, runtime/FreeSWITCH, webhook management, and outbound-call initiation endpoints are rate-limited at the API edge. Runtime limits key on the client IP plus a hash of the runtime credential and tenant header, so FreeSWITCH nodes are bounded without logging bearer tokens.

## Error responses

All errors follow the RPC error standard:

```json
{ "error": "NOT_FOUND", "message": "Extension not found", "request_id": "abc123" }
```

Error codes: `NOT_FOUND`, `INVALID_ARGUMENT`, `UNAUTHENTICATED`, `PERMISSION_DENIED`, `ALREADY_EXISTS`, `RESOURCE_EXHAUSTED`, `INTERNAL`, `UNAVAILABLE`.

Every response includes `x-request-id` header.

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `tsx watch src/server.ts` | Auto-restart on file change |
| `build` | `tsc` | Compile to `dist/` |
| `start` | `node dist/server.js` | Run compiled output |
| `lint` | `eslint src` | Static analysis |
| `test` | `vitest run` | Unit tests (no DB required) |

## OpenAPI

The spec lives at `docs/api/openapi.yaml` and is generated from the Zod schemas in `packages/contracts`:

```sh
pnpm --filter @managecallai/contracts build
node scripts/generate-openapi.mjs
```

CI fails if the committed spec is stale.
