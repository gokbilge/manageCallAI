# Release Runbook

Step-by-step operator guide for deploying manageCallAI from a clean environment.

## Prerequisites

- Docker + Docker Compose v2
- A PostgreSQL 17 instance (or use the bundled `docker compose` service)
- Node.js 22, pnpm 10 (for building from source or running migrations)
- A domain or IP reachable by FreeSWITCH for `mod_xml_curl` callbacks (optional for runtime)

---

## 1. Prepare secrets

Generate fresh values for each secret before deploying to any non-local environment.

```sh
# 64-hex AES key for SIP password encryption
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Long random JWT secret (48+ chars)
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"

# Runtime API token shared between the API and FreeSWITCH agent
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

Copy `.env.example` to `.env` and fill in every required variable:

```sh
cp .env.example .env
$EDITOR .env
```

Required at minimum:

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | Full DSN including credentials |
| `JWT_SECRET` | 32+ chars, random |
| `RUNTIME_API_TOKEN` | Shared with FreeSWITCH agent |
| `SIP_SECRET_MASTER_KEY` | Exactly 64 hex chars |
| `SIP_SECRET_KEY_ID` | Any short label, e.g. `v1` |

---

## 2. Start the database

```sh
pnpm db:up          # docker compose up -d postgres
```

Wait for the health check to pass (the `postgres` service uses `pg_isready`).

---

## 3. Run migrations

```sh
pnpm db:migrate
```

This applies all pending SQL files from `db/migrations/` in order. Idempotent — safe to rerun.

Check current state:

```sh
pnpm db:status
```

---

## 4. Build all apps

```sh
pnpm install --frozen-lockfile
pnpm build
```

---

## 5. Start the API

**Development (with hot reload):**

```sh
pnpm dev:api
```

**Production (compiled):**

```sh
node apps/api/dist/server.js
```

Or via Docker:

```sh
docker compose up -d api
```

Confirm health:

```sh
curl http://localhost:3000/health
# → {"status":"ok"}
```

---

## 6. Run smoke tests

```sh
pwsh scripts/mvp-smoke.ps1 -RuntimeToken "$env:RUNTIME_API_TOKEN"
```

The script covers: tenant registration → extension creation → FreeSWITCH directory lookup → call event ingest → IVR flow create → validate → simulate → publish request.

All steps must print green before proceeding.

---

## 7. (Optional) Start the FreeSWITCH runtime stack

Required only for live SIP call routing. Skip for API-only or n8n/MCP deployments.

```sh
# Start FreeSWITCH + ESL agent (requires MANAGECALLAI_TENANT_ID in .env)
pnpm runtime:up     # docker compose --profile freeswitch up -d
```

The agent must be configured with the same `RUNTIME_API_TOKEN` as the API.

Verify the agent is connected by checking the API runtime health endpoint:

```sh
curl -H "Authorization: Bearer $JWT" http://localhost:3000/api/v1/platform/runtime
```

---

## 8. Configure a platform operator (optional)

Set `PLATFORM_OPERATOR_EMAILS` in `.env` to a comma-separated list of email addresses.
Any tenant user who registers or logs in with one of those emails receives `platform_admin`
role and can access `/platform/*` routes.

---

## 9. Set up n8n automation (optional)

See `docs/automation/n8n-guide.md` for the full walkthrough.

Short form:
1. Create an API key: `POST /api/v1/automation/keys` with a JWT token
2. Add the key to n8n as an HTTP Header Auth credential (`Authorization: Bearer mcak_...`)
3. Register a webhook: `POST /api/v1/webhooks` with your n8n webhook URL

---

## 10. Configure Claude Desktop for MCP (optional)

```json
{
  "mcpServers": {
    "managecall": {
      "command": "node",
      "args": ["/path/to/manageCallAI/apps/mcp/dist/index.js"],
      "env": {
        "MANAGECALL_API_URL": "http://localhost:3000",
        "MANAGECALL_API_KEY": "mcak_your_key_here"
      }
    }
  }
}
```

Build the MCP server first: `pnpm --filter @managecallai/mcp build`

---

## Release notes and tags

Before creating a release tag, follow `docs/release/release-notes-policy.md`.

Checklist:

1. Move completed `CHANGELOG.md` entries from `Unreleased` to the target version.
2. Verify every release-note claim against code, tests, docs, or CI evidence.
3. State the SDK package status: not published, publish dry run passed, or published.
4. Attach or link runtime smoke evidence for beta, release-candidate, and production tags.
5. Mark alpha and beta releases as pre-release in GitHub.

Do not create or move public tags from experimental branches. Failed release
candidates require a new numbered tag.

---

## Upgrade procedure

1. Pull the new code: `git pull origin main`
2. Install dependencies: `pnpm install --frozen-lockfile`
3. Apply new migrations: `pnpm db:migrate`
4. Build: `pnpm build`
5. Restart the API (rolling restart if load-balanced)
6. Re-run smoke tests

Migrations are additive and forward-only. There is no automated rollback — if a migration must be reversed, write a new compensating migration.

---

## Rollback procedure

If the API fails after an upgrade:

1. Redeploy the previous Docker image tag or restart the previous process
2. Assess whether the migration must be compensated (check `db/migrations/`)
3. If schema is compatible with the previous code, no migration rollback is needed
4. If not, write and apply a compensating migration, then redeploy

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| API returns 500 on all routes | `DATABASE_URL` unreachable or migration not applied |
| JWT returns 401 immediately | `JWT_SECRET` mismatch between issuer and verifier |
| FreeSWITCH directory returns 401 | `RUNTIME_API_TOKEN` mismatch |
| SIP password decrypt error | `SIP_SECRET_MASTER_KEY` changed without re-encryption |
| MCP server exits on startup | `MANAGECALL_API_KEY` not set or not a valid `mcak_` key |
| Webhook delivery stops | Check `failure_count` / `disabled_at` via `GET /api/v1/webhooks` |
