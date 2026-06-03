# SLICE-60: Setup, Bootstrap, and Deployment Packaging

**Target release:** v0.3.5  
**Design doc:** `docs/design/setup-bootstrap.md`  
**ADR:** `docs/adr/adr-007-setup-bootstrap-architecture.md`  
**Priority:** P0 — required before any external deployment is recommended

---

## Why

manageCallAI v0.3.0 is the first production release but has no first-time setup
experience. Every deployment requires manual database access, direct env-file
editing, and knowledge of all required secrets. This is a blocking adoption gap.

v0.3.5 delivers a complete zero-to-running installation experience for three
deployment targets: VPS/bare-metal (web wizard), Docker Compose (headless
env-var bootstrap), and Kubernetes (Helm chart + initContainer).

---

## Scope

### 1. Database: `system_config` table

- Migration `0052_system_config.sql`: `key TEXT PRIMARY KEY, value TEXT, updated_at`
- Used for: `setup_complete` sentinel; extensible for future operator flags

### 2. API: Bootstrap module (`apps/api/src/modules/setup/`)

**`setup.service.ts`**
- `checkSetupSentinel()` — reads `system_config` for `setup_complete`
- `getHeadlessBootstrapVars()` — reads `SETUP_ADMIN_EMAIL`, `SETUP_ADMIN_PASSWORD`
- `runHeadlessBootstrap(vars)` — runs migrations, creates admin, writes sentinel
- `runMigrations()` — runs pending DB migrations programmatically
- `createPlatformAdmin(email, password)` — bcrypt hash + INSERT
- `writeSentinel()` — INSERT INTO system_config ... ON CONFLICT DO NOTHING
- `validateSetupInputs(body)` — server-side validation for wizard POST
- `testDbConnection()` — verifies DB is reachable and migrations are applied
- `testEslConnection(host, port, password)` — optional FreeSWITCH ESL test

**`setup.controller.ts`**
- `GET /setup` — serves wizard HTML (only when sentinel absent)
- `POST /setup/validate` — validates DB/ESL connectivity
- `POST /setup/complete` — runs full setup, writes sentinel, returns 200
- All routes return 404 when `setup_complete` is present
- Rate limiter: 5 requests/minute/IP (separate from main rate limiter)

**`setup.html`**
- Self-contained single HTML file, no external dependencies
- Uses `fetch()` to call `/setup/validate` and `/setup/complete`
- 7 steps: welcome, database, secrets, admin, FreeSWITCH, review, done
- Secrets displayed in copy-to-clipboard fields; shown once, not stored
- Responsive, accessible; manageCallAI brand colors

**`app.ts` changes**
- Call `runBootstrapIfNeeded(app)` before registering all other routes
- If headless bootstrap runs: complete before route registration
- If wizard mode: register setup controller; all other routes register normally

### 3. Docker Compose: `docker-compose.prod.yml`

- Uses GHCR images (`ghcr.io/gokbilge/managecallai-*:latest`)
- Services: `postgres`, `api`, `worker`, `freeswitch-agent`, `freeswitch`
- FreeSWITCH uses `network_mode: host` for SIP/RTP
- Volumes: `postgres_data`, `recordings`
- All secrets via `env_file: .env.production`
- Health checks on all services
- `restart: unless-stopped` on all services

### 4. Environment template: `.env.production.example`

- All required variables with generation commands in comments
- `SETUP_ADMIN_EMAIL` and `SETUP_ADMIN_PASSWORD` clearly documented as
  "remove after first boot"
- Grouped sections: Database, API, Secrets, Admin Bootstrap, FreeSWITCH,
  Rate Limiting, Storage

### 5. VPS installer: `install.sh`

- Checks/installs Docker via `get.docker.com`
- Creates `/opt/managecallai/`
- Downloads `docker-compose.prod.yml` and `.env.production.example`
- Generates all secrets via `openssl rand -hex 32`
- Detects public IP via `api.ipify.org`
- Prints next steps with secret values
- Does NOT start containers — operator reviews `.env.production` first

### 6. Quickstart documentation: `docs/ops/quickstart.md`

- "15 minutes from zero to running" guide
- Three paths: VPS one-command, Docker Compose manual, Kubernetes/Helm
- Post-setup checklist: carrier trunk, FreeSWITCH hardening, production preflight
- Common troubleshooting (port conflicts, ESL connection failures, SIP TLS)

### 7. Docker Hub publishing

- Update `docker-images.yml` to also push to `docker.io/gokbilge/*`
- Add `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN` secrets to repo
- Tags: `latest` (main), `v0.3.5` (on tag), `sha-<sha>` (all builds)
- Add `managecallai-freeswitch` image to the CI build matrix

### 8. Helm chart: `charts/managecallai/`

- `Chart.yaml`, `values.yaml`, `values.schema.json`
- Templates: namespace, secret, configmap, deployments (api, worker, agent),
  services, ingress (optional), PVC (recordings), HPA (optional)
- `job-migrate.yaml`: Helm pre-install/pre-upgrade hook runs migrations
- Admin created via headless bootstrap (Path 1) using values-injected env vars
- PostgreSQL: bundled subchart (bitnami/postgresql) OR external URL
- README with quick install commands

---

## Out of Scope

- GUI admin panel UI changes (setup wizard is standalone HTML)
- Multi-tenant onboarding wizard (separate feature)
- Automated SSL/TLS certificate provisioning (documented as manual step)
- FreeSWITCH configuration wizard beyond ESL connection test
- AWS/GCP/Azure marketplace listings

---

## Acceptance Criteria

- [ ] `GET /setup` returns 200 with wizard HTML when sentinel absent
- [ ] `GET /setup` returns 404 when sentinel present
- [ ] Headless bootstrap creates admin and writes sentinel when all SETUP_* vars set
- [ ] Restart during partial setup does not corrupt state (idempotency)
- [ ] `SETUP_ADMIN_PASSWORD` cleared from process env after use
- [ ] `docker compose -f docker-compose.prod.yml up -d` starts all services from GHCR images
- [ ] `install.sh` generates secrets, writes `.env.production`, prints instructions
- [ ] `docs/ops/quickstart.md` covers all three deployment paths
- [ ] `helm install managecallai managecallai/managecallai --set ...` completes without error
- [ ] Helm migration job runs before API pod starts
- [ ] Docker Hub images published on tag push
- [ ] `managecallai-freeswitch` image added to CI build matrix

---

## Required Evidence

- Integration tests: setup controller (sentinel present/absent, rate limit, validation)
- Integration test: headless bootstrap (admin created, sentinel written, idempotent restart)
- Smoke test: `docker compose -f docker-compose.prod.yml up -d` on `enlogy@10.0.0.32`
  with fresh DB; confirm `/health` returns 200 and admin login works
- Helm chart: `helm install --dry-run` passes; `helm lint` passes

---

## Files Created / Modified

```
New:
  apps/api/src/modules/setup/setup.service.ts
  apps/api/src/modules/setup/setup.controller.ts
  apps/api/src/modules/setup/setup.types.ts
  apps/api/src/modules/setup/setup.html
  apps/api/src/modules/setup/setup.integration.test.ts
  db/migrations/0052_system_config.sql
  docker-compose.prod.yml
  .env.production.example
  install.sh
  docs/ops/quickstart.md
  charts/managecallai/Chart.yaml
  charts/managecallai/values.yaml
  charts/managecallai/values.schema.json
  charts/managecallai/templates/ (9 files)
  charts/managecallai/README.md

Modified:
  apps/api/src/app.ts               (bootstrap hook)
  .github/workflows/docker-images.yml (Docker Hub + FreeSWITCH image)
  CLAUDE.md                         (SLICE-60 reference)
  docs/architecture/source-of-truth.md (setup section)
```

---

## Dependencies

- SLICE-60 has no blocking dependencies on other slices
- Prerequisite: Docker Hub account and `DOCKERHUB_TOKEN` secret set in repo
- Prerequisite: `managecallai-freeswitch` Dockerfile confirmed buildable from CI
