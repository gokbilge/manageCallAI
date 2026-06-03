# ADR-007: Setup and Bootstrap Architecture

## Status

Accepted

## Date

2026-06-03

## Context

manageCallAI v0.3.0 is the first production release. For v0.3.5, the project
must support first-time installation across three deployment targets:

1. **VPS / bare-metal** — operator SSHes in, wants a guided setup experience
2. **Docker Compose** — operator runs `docker compose up`, wants zero-click
   automation when env vars are pre-set
3. **Kubernetes** — Helm chart deployment, fully headless, secrets from K8s
   Secret manifests

The system has mandatory first-run actions that must happen exactly once:

- Database migrations
- Secrets validation (JWT_SECRET, RUNTIME_API_TOKEN, SIP_SECRET_MASTER_KEY
  must all be non-default, production-grade values)
- Platform admin account creation
- FreeSWITCH ESL connectivity test (optional but recommended)
- Setup sentinel write (prevents re-entry)

There is no prior first-run system. Every deployment currently requires manual
steps and direct database access.

### Constraints

- The setup wizard must not be accessible after setup is complete.
- Setup must not require the operator to install Node.js or pnpm on the host
  for Docker/VPS deployments — Docker images contain everything.
- Secrets must never be hardcoded, committed, or returned to the browser
  in plaintext after the setup transaction.
- The system must handle restarts gracefully during a partial setup (idempotent).
- Kubernetes deployments must be fully headless — no browser wizard required.

### Alternatives considered

**A. Separate setup container (run once, then remove)**
A dedicated container that performs setup and exits. Requires orchestrating a
container that only runs once, awkward in Compose and fragile in K8s.
Rejected: adds operational complexity with no benefit over the sentinel model.

**B. Setup script that writes `.env` to the host**
A shell script generates secrets and writes `.env.production`. Requires the
operator to have shell access and run extra commands. Does not work headlessly
in Docker or K8s. Rejected as the sole mechanism; retained as an optional
convenience (`install.sh`) for VPS.

**C. Web wizard as a separate service**
A React app on a separate port (e.g., `:3001`) that is removed from Compose
after setup. Rejected: requires a second service, a second port, and a second
build. The main API can serve the wizard on `/setup` and lock it cheaply.

**D. Mattermost-style env-var-only (no wizard)**
Pure env-var bootstrap, no browser wizard. Simpler to implement but creates
a poor VPS experience where operators must edit config files before the system
will start. Rejected as the sole mechanism; retained as the Docker/K8s path.

## Decision

Implement a **three-path bootstrap model** modelled on the Gitea + Mattermost
hybrid:

### Path 1 — ENV-VAR headless (Docker Compose / Kubernetes)

If the following env vars are all present and non-default at startup:
`SETUP_ADMIN_EMAIL`, `SETUP_ADMIN_PASSWORD`, `JWT_SECRET`,
`RUNTIME_API_TOKEN`, `SIP_SECRET_MASTER_KEY`

Then on first boot the API:
1. Runs pending migrations automatically
2. Creates the platform admin user
3. Writes the setup sentinel to the DB
4. Logs `setup complete` to stdout once
5. Continues normal operation

This path requires no browser, no wizard, no extra container.

### Path 2 — Web wizard (VPS / bare-metal)

If the sentinel is not set and the headless env vars are absent, the API serves
a setup wizard at `GET /setup`. This route returns 404 after the sentinel is
written.

The wizard is a single self-contained HTML page served directly by the API —
no React build step, no separate bundle. It:
1. Tests the database connection
2. Generates and displays secrets (operator copies them to their env)
3. Accepts admin email + password
4. Optionally tests FreeSWITCH ESL connectivity
5. Runs migrations, creates admin, writes sentinel
6. Redirects to the admin panel

The wizard is only reachable before setup is complete. After the sentinel is
written, `/setup` returns 404 permanently.

### Path 3 — Helm initContainer (Kubernetes)

A Kubernetes Helm chart provides a `migration` initContainer that runs
`node db/migrate.mjs` before the main API pod starts. Secrets are injected
from a Kubernetes `Secret` manifest (via `secretKeyRef`). The headless env-var
bootstrap (Path 1) handles admin creation. No wizard is ever served.

### Sentinel mechanism

The setup sentinel is a row in a new `system_config` table:

```sql
INSERT INTO system_config (key, value) VALUES ('setup_complete', 'true')
ON CONFLICT (key) DO NOTHING;
```

On every API startup, if `setup_complete` exists in `system_config` the setup
routes are never registered. If it is absent, setup mode is active.

This is DB-backed (not file-backed) so it survives container restarts and works
correctly across horizontal replicas.

### Supporting artefacts

| Artefact | Purpose |
|---|---|
| `docker-compose.prod.yml` | Production Compose using GHCR images |
| `.env.production.example` | Production env template with generation commands |
| `install.sh` | One-command VPS bootstrap (installs Docker, pulls images, opens wizard) |
| `apps/setup/` | Helm chart and `docs/ops/helm.md` for Kubernetes |
| `docs/ops/quickstart.md` | "Zero to running in 15 minutes" guide |

## Consequences

**Positive:**
- Zero extra containers or services for setup
- Docker/K8s deployments are fully automated
- VPS operators get a guided browser wizard
- `/setup` is unreachable after first run (no attack surface)
- Sentinel is idempotent — safe to restart mid-setup
- Works with the existing DB migration system

**Tradeoffs:**
- The API must have setup-mode code that is dead code in production; this is
  acceptable because it is gated behind a startup check and adds no runtime cost
- The wizard HTML is served from the API bundle; it must never include secrets
  in its source

**What becomes easier:**
- One-command Docker deployment with `docker compose -f docker-compose.prod.yml up`
- Kubernetes deployment via `helm install`
- No manual migration steps for any deployment scenario

**What becomes harder:**
- Adding a new required first-run step requires updating all three paths
- Changing the sentinel mechanism requires a migration

## Notes

- Related implementation: `SLICE-60`
- Related design doc: `docs/design/setup-bootstrap.md`
- The `system_config` table is general-purpose and can hold other operator
  configuration flags in the future (feature flags, maintenance mode, etc.)
- The wizard must validate all inputs server-side — the wizard form is a
  public HTTP endpoint until setup is complete
