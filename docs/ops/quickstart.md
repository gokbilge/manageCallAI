# Quickstart

This is the shortest path to a running `manageCallAI` `v0.3.5` deployment.

## Requirements

- Linux host or VM with Docker support
- Public IP if FreeSWITCH will handle external SIP/RTP
- PostgreSQL only if you do not use the bundled Compose service

## Path 1: VPS installer

```bash
curl -fsSL https://raw.githubusercontent.com/gokbilge/manageCallAI/v0.3.5/install.sh | bash
cd /opt/managecallai
vi .env.production
docker compose -f docker-compose.prod.yml up -d
```

Open `http://<server-ip>:3000/setup` if setup has not completed headlessly.

## Path 2: Docker Compose

```bash
cp .env.production.example .env.production
vi .env.production
docker compose -f docker-compose.prod.yml up -d
```

Required first-boot values:

- `JWT_SECRET`
- `RUNTIME_API_TOKEN`
- `SIP_SECRET_MASTER_KEY`
- `PLATFORM_OPERATOR_EMAILS`
- `SETUP_ADMIN_EMAIL`
- `SETUP_ADMIN_PASSWORD`

Headless bootstrap runs automatically when the `SETUP_*` variables are present
and the admin email is included in `PLATFORM_OPERATOR_EMAILS`.

## Path 3: Kubernetes / Helm

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

The Helm pre-install job runs migrations. The API deployment then performs the
same headless bootstrap path used by Compose.

## After first boot

1. Log in with the bootstrap tenant slug and admin email.
2. Remove `SETUP_ADMIN_PASSWORD` from the runtime environment.
3. Configure carrier trunks and inbound routes.
4. Run `pnpm production:preflight` against the target environment.
5. Apply FreeSWITCH, firewall, TLS, SRTP, and backup hardening from `docs/ops/`.

## Troubleshooting

- `/setup` returns `404`: setup sentinel already exists in `system_config`.
- Headless bootstrap does not run: check `PLATFORM_OPERATOR_EMAILS` includes `SETUP_ADMIN_EMAIL`.
- FreeSWITCH agent healthcheck fails: verify `FREESWITCH_ESL_*` values and port `8021`.
- SIP/RTP reachability issues: confirm host firewall and `FREESWITCH_EXTERNAL_SIP_IP` / `FREESWITCH_EXTERNAL_RTP_IP`.
