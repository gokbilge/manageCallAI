# manageCallAI Helm chart

## Install

```bash
helm install managecallai ./charts/managecallai \
  --set secrets.databaseUrl=postgres://managecallai:... \
  --set secrets.jwtSecret=$(openssl rand -hex 32) \
  --set secrets.runtimeApiToken=$(openssl rand -hex 32) \
  --set secrets.sipSecretMasterKey=$(openssl rand -hex 32) \
  --set secrets.freeswitchEslPassword=$(openssl rand -hex 16) \
  --set bootstrap.platformOperatorEmails=admin@example.com \
  --set bootstrap.adminEmail=admin@example.com \
  --set bootstrap.adminPassword='StrongPassword123!'
```

The chart runs a migration hook before install or upgrade, then boots the API,
worker, and FreeSWITCH agent deployments with the same headless bootstrap path
used by `docker-compose.prod.yml`.

## Scope

- API deployment
- Worker deployment
- FreeSWITCH agent deployment
- Secret and ConfigMap wiring
- Optional ingress
- Recordings PVC
- Pre-install/pre-upgrade migration job

This chart does not deploy a FreeSWITCH pod. FreeSWITCH remains a separate
runtime concern because SIP/RTP networking is usually host- or node-specific.
