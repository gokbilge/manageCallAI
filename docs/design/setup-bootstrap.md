# Setup and Bootstrap Design

> Architecture decision: ADR-007  
> Implementation: SLICE-60  
> Target release: v0.3.5

manageCallAI must support first-time installation on three deployment targets:
VPS/bare-metal, Docker Compose, and Kubernetes. This document defines every
component of the setup and bootstrap system.

---

## 1. Core Concept: The Setup Sentinel

A single row in the `system_config` table gates the entire setup system:

```sql
CREATE TABLE IF NOT EXISTS system_config (
    key        text PRIMARY KEY,
    value      text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
```

On every API startup:

```
system_config WHERE key = 'setup_complete'
  → found: skip all setup logic, register no setup routes
  → not found: enter setup mode
```

Setup mode activates one of two paths depending on env vars.

---

## 2. Bootstrap Paths

### Path 1 — ENV-VAR Headless (Docker / Kubernetes)

**Trigger:** All of the following env vars are set and non-default at startup:

| Env var | Validation |
|---|---|
| `SETUP_ADMIN_EMAIL` | Valid email format |
| `SETUP_ADMIN_PASSWORD` | ≥ 12 characters |
| `JWT_SECRET` | ≥ 32 chars, not `change-me-*` |
| `RUNTIME_API_TOKEN` | ≥ 32 chars, not `change-me-*` |
| `SIP_SECRET_MASTER_KEY` | 64 hex chars, not `0123456789abc...` |

**Sequence on first boot:**

```
1. DB connected + healthy
2. Run pending migrations (same as pnpm db:migrate)
3. Check setup_complete sentinel → absent
4. Validate all SETUP_* env vars
5. Hash SETUP_ADMIN_PASSWORD (bcrypt, cost 12)
6. INSERT INTO users (email, role='platform_admin', ...)
7. INSERT INTO system_config (key='setup_complete', value='true')
8. Log once: "manageCallAI setup complete. Admin: <email>"
9. Unset / clear SETUP_ADMIN_PASSWORD from process env
10. Continue normal startup
```

**Idempotency:** If the process restarts between steps 5 and 7, the sentinel
is absent, so the sequence retries from step 4. The user INSERT uses
`ON CONFLICT DO NOTHING`, so duplicate emails are safe.

### Path 2 — Web Wizard (VPS / bare-metal)

**Trigger:** Sentinel absent AND `SETUP_ADMIN_EMAIL` is not set.

The API registers two temporary routes:

```
GET  /setup          → serves setup wizard HTML
POST /setup/validate → validates DB/ESL connectivity (JSON)
POST /setup/complete → runs setup and writes sentinel (JSON)
```

These routes return `404` as soon as `setup_complete` is written.

**Wizard flow (browser):**

```
Step 1: Welcome
  - System info (version, OS, Docker version)
  - Prerequisites checklist

Step 2: Database
  - Shows detected DATABASE_URL (masked)
  - "Test connection" → POST /setup/validate { type: "db" }
  - Shows migration count pending

Step 3: Secrets
  - Generates JWT_SECRET, RUNTIME_API_TOKEN, SIP_SECRET_MASTER_KEY
    server-side via crypto.randomBytes(32).toString('hex')
  - Displays each in a copy-to-clipboard field
  - "I have saved these secrets" checkbox required to proceed
  - ⚠️ These are shown ONCE. They are not stored server-side.
    Operator must set them in their env before setup completes.

Step 4: Admin account
  - Email (validated)
  - Password (min 12 chars, strength meter)
  - Confirm password

Step 5: FreeSWITCH (optional)
  - ESL host, port, password
  - "Test ESL connection" → POST /setup/validate { type: "esl" }
  - "Skip for now" allowed

Step 6: Review + confirm
  - Summary of all settings
  - "Complete setup" button

Step 7: Done
  - "Setup complete ✓"
  - Link to admin panel
  - Instructions: add the generated secrets to your .env
  - /setup now returns 404
```

**Security constraints on the wizard:**

- `POST /setup/complete` validates all inputs server-side (not just client-side)
- Rate-limited: 5 attempts per IP per minute
- Only accessible on localhost by default when `APP_ENV=production`
  (can be overridden with `ALLOW_REMOTE_SETUP=true` for cloud VPS)
- No secrets are stored in the wizard's HTML or JS
- `Content-Security-Policy: default-src 'self'` on all setup routes

### Path 3 — Kubernetes Helm (initContainer)

**Trigger:** Always headless; the env-var path (Path 1) handles admin creation.

The Helm chart includes a `migration` initContainer that runs before the API
pod starts:

```yaml
initContainers:
  - name: migrate
    image: ghcr.io/gokbilge/managecallai-api:{{ .Chart.AppVersion }}
    command: ["node", "db/migrate.mjs"]
    env:
      - name: DATABASE_URL
        valueFrom:
          secretKeyRef:
            name: managecallai-secrets
            key: database-url
```

The main API pod uses Path 1 (env-var headless) to create the admin and write
the sentinel. All secrets come from a Kubernetes `Secret` manifest.

---

## 3. docker-compose.prod.yml

Production Compose uses GHCR images (pre-built, no local build required):

```yaml
# docker-compose.prod.yml
# Pull and run manageCallAI v0.3.5 with pre-built images.
# Usage:
#   cp .env.production.example .env.production
#   # fill in .env.production (see docs/ops/quickstart.md)
#   docker compose -f docker-compose.prod.yml up -d

services:
  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-managecallai}
      POSTGRES_USER: ${POSTGRES_USER:-managecallai}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}   # required, no default
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-managecallai}"]
      interval: 5s
      retries: 12

  api:
    image: ghcr.io/gokbilge/managecallai-api:latest
    restart: unless-stopped
    env_file: .env.production
    ports:
      - "${API_PORT:-3000}:3000"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1"]
      interval: 10s
      retries: 12

  worker:
    image: ghcr.io/gokbilge/managecallai-worker:latest
    restart: unless-stopped
    env_file: .env.production
    depends_on:
      api:
        condition: service_healthy

  freeswitch-agent:
    image: ghcr.io/gokbilge/managecallai-freeswitch-agent:latest
    restart: unless-stopped
    env_file: .env.production
    depends_on:
      api:
        condition: service_healthy

  freeswitch:
    image: ghcr.io/gokbilge/managecallai-freeswitch:latest
    restart: unless-stopped
    network_mode: host    # required for SIP/RTP
    env_file: .env.production
    volumes:
      - recordings:/recordings

volumes:
  postgres_data:
  recordings:
```

**Why `network_mode: host` for FreeSWITCH:**
SIP and RTP require the container to bind to the host's public IP. NAT traversal
and RTP port ranges (16384–32768) do not work correctly with Docker bridge
networking. This is the same approach used by FusionPBX Docker and Fonoster.
The API and other services use bridge networking.

---

## 4. .env.production.example

```bash
# manageCallAI v0.3.5 production environment
# Generate secrets: openssl rand -hex 32
# Full reference: docs/ops/production-deployment.md

# ── Database ──────────────────────────────────────────────────────────────────
POSTGRES_PASSWORD=<generate: openssl rand -hex 16>
DATABASE_URL=postgres://managecallai:<POSTGRES_PASSWORD>@postgres:5432/managecallai

# ── API ───────────────────────────────────────────────────────────────────────
APP_ENV=production
API_PORT=3000

# ── Secrets (generate each with: openssl rand -hex 32) ───────────────────────
JWT_SECRET=<generate>
RUNTIME_API_TOKEN=<generate>
SIP_SECRET_MASTER_KEY=<generate>   # must be exactly 64 hex chars
SIP_SECRET_KEY_ID=v1
ALLOW_RUNTIME_TOKEN_FALLBACK=false

# ── First-run admin bootstrap (Path 1 — headless) ────────────────────────────
# Set these for automatic setup on first boot.
# After setup completes, these can be removed from the env.
SETUP_ADMIN_EMAIL=admin@yourcompany.com
SETUP_ADMIN_PASSWORD=<strong password, min 12 chars>

# ── Platform operator access ──────────────────────────────────────────────────
PLATFORM_OPERATOR_EMAILS=admin@yourcompany.com

# ── FreeSWITCH ────────────────────────────────────────────────────────────────
FREESWITCH_ESL_HOST=127.0.0.1
FREESWITCH_ESL_PORT=8021
FREESWITCH_ESL_PASSWORD=<change from ClueCon>
FREESWITCH_EXTERNAL_SIP_IP=<your server public IP>
FREESWITCH_EXTERNAL_RTP_IP=<your server public IP>
FREESWITCH_RTP_PORT_MIN=16384
FREESWITCH_RTP_PORT_MAX=32768
SIP_TLS_ENABLED=true
SRTP_POLICY=optional

# ── Storage ───────────────────────────────────────────────────────────────────
RECORDING_STORAGE_ROOT=/recordings

# ── Rate limiting ─────────────────────────────────────────────────────────────
MANAGECALLAI_INSTANCE_COUNT=1
RATE_LIMIT_AUTH_MAX=20
RATE_LIMIT_RUNTIME_MAX=300
RATE_LIMIT_WEBHOOK_MAX=100
RATE_LIMIT_OUTBOUND_MAX=30
RATE_LIMIT_WINDOW_MS=60000

# ── Worker ────────────────────────────────────────────────────────────────────
API_BASE_URL=http://api:3000
WORKER_PORT=3400
```

---

## 5. install.sh (VPS one-command)

```bash
#!/usr/bin/env bash
# manageCallAI installer — run once on a fresh VPS
# Usage: curl -fsSL https://get.managecallai.com | bash
set -euo pipefail

VERSION="v0.3.5"
INSTALL_DIR="/opt/managecallai"

# 1. Check / install Docker
if ! command -v docker &>/dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

# 2. Create install directory
mkdir -p "$INSTALL_DIR" && cd "$INSTALL_DIR"

# 3. Download production compose + env template
curl -fsSL "https://raw.githubusercontent.com/gokbilge/manageCallAI/$VERSION/docker-compose.prod.yml" \
  -o docker-compose.prod.yml
curl -fsSL "https://raw.githubusercontent.com/gokbilge/manageCallAI/$VERSION/.env.production.example" \
  -o .env.production

# 4. Generate secrets inline
JWT=$(openssl rand -hex 32)
TOKEN=$(openssl rand -hex 32)
SIP=$(openssl rand -hex 32)
PG_PASS=$(openssl rand -hex 16)
ESL_PASS=$(openssl rand -hex 16)
PUBLIC_IP=$(curl -fsSL https://api.ipify.org 2>/dev/null || echo "127.0.0.1")

sed -i "s|<generate: openssl rand -hex 16>|$PG_PASS|g" .env.production
sed -i "s|<generate>|PLACEHOLDER|1; s|PLACEHOLDER|$JWT|" .env.production
sed -i "s|<generate>|PLACEHOLDER|1; s|PLACEHOLDER|$TOKEN|" .env.production
sed -i "s|<generate>|PLACEHOLDER|1; s|PLACEHOLDER|$SIP|" .env.production
sed -i "s|<change from ClueCon>|$ESL_PASS|g" .env.production
sed -i "s|<your server public IP>|$PUBLIC_IP|g" .env.production
sed -i "s|postgres://managecallai:<POSTGRES_PASSWORD>|postgres://managecallai:$PG_PASS|g" .env.production

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " manageCallAI $VERSION installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo " Secrets written to: $INSTALL_DIR/.env.production"
echo " IMPORTANT: Back up this file — secrets are not"
echo " recoverable if lost."
echo ""
echo " Next step: edit .env.production to set:"
echo "   SETUP_ADMIN_EMAIL=you@example.com"
echo "   SETUP_ADMIN_PASSWORD=<strong password>"
echo ""
echo " Then run: docker compose -f docker-compose.prod.yml up -d"
echo ""
echo " For guided setup open: http://$PUBLIC_IP:3000/setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

---

## 6. Helm Chart Structure (Kubernetes)

```
charts/managecallai/
├── Chart.yaml
├── values.yaml                    # user-facing defaults
├── values.schema.json             # validation
├── templates/
│   ├── _helpers.tpl
│   ├── namespace.yaml
│   ├── secret.yaml                # all secrets (from values or external)
│   ├── configmap.yaml             # non-secret config
│   ├── deployment-api.yaml        # API pods
│   ├── deployment-worker.yaml
│   ├── deployment-freeswitch-agent.yaml
│   ├── service-api.yaml
│   ├── ingress.yaml               # optional
│   ├── pvc-recordings.yaml
│   ├── job-migrate.yaml           # Helm hook: pre-install, pre-upgrade
│   └── hpa.yaml                  # optional horizontal pod autoscaler
└── README.md
```

**values.yaml (abbreviated):**

```yaml
image:
  registry: ghcr.io/gokbilge
  tag: "v0.3.5"
  pullPolicy: IfNotPresent

replicaCount: 1

admin:
  email: ""           # required
  password: ""        # required; stored in Secret, not ConfigMap

secrets:
  jwtSecret: ""       # required; generate with: openssl rand -hex 32
  runtimeApiToken: "" # required
  sipSecretMasterKey: "" # required; 64 hex chars

postgresql:
  external: false
  url: ""             # set when external: true
  internal:           # used when external: false (deploys postgres subchart)
    password: ""      # required

freeswitch:
  eslHost: "127.0.0.1"
  eslPort: 8021
  eslPassword: ""     # required
  externalSipIp: ""   # required for NAT
  externalRtpIp: ""   # required for NAT

ingress:
  enabled: false
  hostname: ""
  tls: false

storage:
  recordings:
    size: 50Gi
    storageClass: ""
```

**Migration job (Helm pre-install hook):**

```yaml
# job-migrate.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "managecallai.fullname" . }}-migrate
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  template:
    spec:
      restartPolicy: Never
      initContainers: []
      containers:
        - name: migrate
          image: "{{ .Values.image.registry }}/managecallai-api:{{ .Values.image.tag }}"
          command: ["node", "db/migrate.mjs"]
          envFrom:
            - secretRef:
                name: {{ include "managecallai.fullname" . }}-secrets
```

---

## 7. API Changes Required

### New: `system_config` table

Migration `0052_system_config.sql`:

```sql
CREATE TABLE IF NOT EXISTS system_config (
    key        text PRIMARY KEY,
    value      text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE system_config IS
    'Platform-level configuration flags. setup_complete=true means first-run '
    'setup has been completed and the /setup route is permanently locked.';
```

### New: Setup module

```
apps/api/src/modules/setup/
├── setup.controller.ts    # GET /setup, POST /setup/validate, POST /setup/complete
├── setup.service.ts       # migration runner, admin creation, sentinel write
├── setup.types.ts
└── setup.html             # wizard HTML (embedded in build)
```

### New: Startup bootstrap check

In `apps/api/src/app.ts` (or a dedicated `apps/api/src/bootstrap.ts`):

```typescript
export async function runBootstrapIfNeeded(app: FastifyInstance): Promise<void> {
  const isSetupComplete = await checkSetupSentinel();
  if (isSetupComplete) return;

  const headlessVars = getHeadlessBootstrapVars();
  if (headlessVars) {
    await runHeadlessBootstrap(headlessVars);
    return;
  }

  // Setup wizard mode: register /setup routes
  app.register(setupController, { prefix: '/setup' });
}
```

### Rate limiting on setup routes

Setup routes use a dedicated in-process rate limiter (5 req/min/IP) that is
independent of the production rate limiter. It is removed when setup completes.

---

## 8. Dependent Images

| Image | Source | Notes |
|---|---|---|
| `ghcr.io/gokbilge/managecallai-api` | This repo | Built by CI |
| `ghcr.io/gokbilge/managecallai-worker` | This repo | Built by CI |
| `ghcr.io/gokbilge/managecallai-mcp` | This repo | Built by CI |
| `ghcr.io/gokbilge/managecallai-freeswitch-agent` | This repo | Built by CI |
| `ghcr.io/gokbilge/managecallai-freeswitch` | This repo | Built from `freeswitch/docker/Dockerfile` |
| `postgres:17-alpine` | Docker Hub official | No changes needed |
| `redis:7-alpine` | Docker Hub official | Optional; required for multi-instance rate limiting |

The `managecallai-freeswitch` image is already built locally for smoke tests.
It needs to be added to the `docker-images.yml` CI workflow and published to
GHCR alongside the other images.

---

## 9. docs/ops/quickstart.md

The quickstart guide covers:

1. **System requirements** (2 CPU, 4 GB RAM, 40 GB disk, Ubuntu 22.04+)
2. **Docker Compose** (< 5 minutes):
   ```bash
   curl -fsSL https://get.managecallai.com | bash
   # edit /opt/managecallai/.env.production
   docker compose -f /opt/managecallai/docker-compose.prod.yml up -d
   # open http://your-ip:3000/setup
   ```
3. **Kubernetes / Helm** (< 10 minutes):
   ```bash
   helm repo add managecallai https://charts.managecallai.com
   helm install managecallai managecallai/managecallai \
     --set admin.email=... \
     --set admin.password=... \
     --set secrets.jwtSecret=$(openssl rand -hex 32) \
     ...
   ```
4. **Post-setup**: carrier trunk configuration, FreeSWITCH hardening check,
   running `pnpm production:preflight`
5. **Backup**: what to back up and how often

---

## 10. Security Considerations

| Risk | Mitigation |
|---|---|
| `/setup` accessible after setup | Sentinel check on every request; 404 after write |
| Brute-force admin password during setup | Rate limit: 5 attempts/min/IP |
| Secrets leaked in wizard HTML | Secrets generated server-side, never embedded in HTML |
| Remote setup on cloud VPS | `ALLOW_REMOTE_SETUP=true` required; default blocks non-localhost |
| Partial setup leaves system in inconsistent state | All setup steps in a DB transaction; sentinel only written on full success |
| `SETUP_ADMIN_PASSWORD` in process env after setup | Cleared from `process.env` after use |
| Container image layer caches secrets | Secrets injected at runtime via env vars, never in Dockerfile |
