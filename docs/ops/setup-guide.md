# Setup Guide

This guide is for people installing `manageCallAI` for the first time.

It explains:

- what you need before starting
- which install path to choose
- how to complete first boot
- what to check after setup

This is a user guide. It does not replace the deeper architecture, release, or
operations documents.

## 1. Before you start

You need:

- a Linux server or VM
- Docker and Docker Compose support
- a public IP address if FreeSWITCH will handle external SIP and RTP traffic
- basic shell access on the target machine

Recommended minimums:

- 2 CPU
- 4 GB RAM
- 40 GB storage

You should also decide these before installation:

- the admin email address you will use to sign in
- the platform operator email list
- whether you want browser-based setup or headless bootstrap

## 2. Choose an installation path

There are three supported setup paths in the repository.

### Path A: VPS installer

Use this if you want the fastest path on a fresh server.

```bash
curl -fsSL https://raw.githubusercontent.com/gokbilge/manageCallAI/v0.3.5/install.sh | bash
cd /opt/managecallai
vi .env.production
docker compose -f docker-compose.prod.yml up -d
```

This path:

- installs Docker if needed
- downloads the production compose file
- creates `.env.production`
- generates initial secrets

After the stack starts, open:

```text
http://<server-ip>:3000/setup
```

unless headless bootstrap already completed setup.

### Path B: Docker Compose

Use this if you want to review and control the environment file yourself.

```bash
cp .env.production.example .env.production
vi .env.production
docker compose -f docker-compose.prod.yml up -d
```

You must fill in the required values before first boot.

### Path C: Helm

Use this only if you are deploying into Kubernetes.

```bash
helm install managecallai ./charts/managecallai \
  --set secrets.databaseUrl=postgres://... \
  --set secrets.jwtSecret=$(openssl rand -hex 32) \
  --set secrets.runtimeApiToken=$(openssl rand -hex 32) \
  --set secrets.sipSecretMasterKey=$(openssl rand -hex 32) \
  --set bootstrap.platformOperatorEmails=admin@example.com \
  --set bootstrap.adminEmail=admin@example.com \
  --set bootstrap.adminPassword='StrongPassword123!' \
  --set freeswitch.eslPassword=$(openssl rand -hex 16)
```

The Helm chart in the repository is packaging scaffolding. Treat it as an
operator path, not as proof that your target environment is production-ready.

## 3. Required first-boot values

These values matter on every new install:

- `JWT_SECRET`
- `RUNTIME_API_TOKEN`
- `SIP_SECRET_MASTER_KEY`
- `PLATFORM_OPERATOR_EMAILS`
- `SETUP_ADMIN_EMAIL`
- `SETUP_ADMIN_PASSWORD`

Important rules:

- `SETUP_ADMIN_EMAIL` must also appear in `PLATFORM_OPERATOR_EMAILS`
- `SIP_SECRET_MASTER_KEY` must be a 64-character hex value
- `SETUP_ADMIN_PASSWORD` should be strong and should be removed after bootstrap

The production example file is:

- [.env.production.example](../../.env.production.example)

## 4. Browser setup vs headless setup

There are two first-boot modes.

### Browser setup

If setup is incomplete and headless bootstrap is not configured, the API exposes:

- `GET /setup`
- `POST /setup/validate`
- `POST /setup/complete`

Use browser setup if you want to walk through installation interactively.

### Headless bootstrap

If `SETUP_*` values are present, setup runs automatically on first boot.

Use headless bootstrap if you want a container-first or automation-friendly install.

Headless bootstrap:

- creates the bootstrap tenant
- creates the initial admin
- writes the `setup_complete` sentinel
- disables the `/setup` flow after success

## 5. First boot checklist

After you start the stack:

1. Confirm the API is reachable on port `3000`.
2. Open `/setup` if headless bootstrap did not run.
3. Complete first admin setup.
4. Sign in with the bootstrap admin account.
5. Confirm the tenant slug and operator email are correct.
6. Remove `SETUP_ADMIN_PASSWORD` from the runtime environment.
7. Restart the stack if you changed environment values.

## 6. What to do after setup

After first login, do these next:

1. Configure FreeSWITCH and ESL connectivity.
2. Add SIP trunks.
3. Add extensions.
4. Add phone numbers and routes.
5. Run the production preflight checks for the target environment.
6. Apply firewall, TLS, SRTP, backup, and hardening guidance from the other ops docs.

Useful follow-on docs:

- [quickstart.md](quickstart.md)
- [production-deployment.md](production-deployment.md)
- [production-preflight.md](production-preflight.md)
- [freeswitch-hardening.md](freeswitch-hardening.md)
- [sip-tls-srtp-nat.md](sip-tls-srtp-nat.md)
- [backup-restore.md](backup-restore.md)

## 7. Common problems

### `/setup` returns `404`

Usually this means setup already completed and `system_config.setup_complete`
exists.

### Headless bootstrap does not run

Check:

- `SETUP_ADMIN_EMAIL` is set
- `SETUP_ADMIN_PASSWORD` is set
- `SETUP_ADMIN_EMAIL` is included in `PLATFORM_OPERATOR_EMAILS`

### FreeSWITCH agent healthcheck fails

Check:

- `FREESWITCH_ESL_HOST`
- `FREESWITCH_ESL_PORT`
- `FREESWITCH_ESL_PASSWORD`
- port `8021` reachability

### SIP or RTP does not work externally

Check:

- `FREESWITCH_EXTERNAL_SIP_IP`
- `FREESWITCH_EXTERNAL_RTP_IP`
- RTP port range
- host firewall rules
- NAT and TLS/SRTP settings

## 8. Security notes

- Back up `.env.production` before first boot.
- Do not leave bootstrap passwords in place longer than needed.
- Do not assume setup scripts are production evidence.
- If you are preparing a production deployment, follow the release and evidence gates separately.

## 9. Summary

If you want the shortest path:

1. run `install.sh`
2. edit `.env.production`
3. start `docker compose`
4. complete `/setup`
5. remove bootstrap secrets
6. configure trunks, numbers, and routes

For a shorter reference, use [quickstart.md](quickstart.md).
