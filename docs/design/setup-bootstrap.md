# Setup and Bootstrap Design

> Architecture decision: ADR-007  
> Implementation: SLICE-60  
> Target code line: v0.3.5

manageCallAI supports first-time installation on three deployment targets:

- VPS or bare metal
- Docker Compose
- Kubernetes

This document describes the setup and bootstrap model implemented in the repository. Release readiness for these paths still depends on runtime evidence and operator validation outside the source tree.

## 1. Setup sentinel

`system_config` gates first-run setup:

```sql
CREATE TABLE IF NOT EXISTS system_config (
    key        text PRIMARY KEY,
    value      text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
```

Startup behavior:

```text
system_config WHERE key = 'setup_complete'
  -> found: skip setup logic and do not register setup routes
  -> not found: enter setup mode
```

## 2. Bootstrap paths

### Path 1 - headless env-var bootstrap

Used for containerized deployment when `SETUP_*` variables are provided.

Current implementation shape:

1. connect to the database
2. confirm setup sentinel is absent
3. validate `SETUP_ADMIN_EMAIL`, `SETUP_ADMIN_PASSWORD`, and related env config
4. create the bootstrap tenant and initial admin through API-owned logic
5. write `system_config.setup_complete=true`
6. continue normal startup without `/setup`

### Path 2 - web setup wizard

Used when setup is incomplete and headless bootstrap is not configured.

Current route surface:

- `GET /setup`
- `POST /setup/validate`
- `POST /setup/complete`

After setup completes, these routes are no longer registered.

### Path 3 - Kubernetes packaging

The Helm chart scaffold assumes headless bootstrap and migration-first startup.

The chart is packaging and configuration scaffolding. It is not by itself evidence that Kubernetes installation has been validated in a target environment.

## 3. API responsibilities

The setup subsystem lives under `apps/api/src/modules/setup` and is activated from API startup code in:

- `apps/api/src/app.ts`
- `apps/api/src/server.ts`

The API owns:

- setup eligibility checks
- sentinel checks
- first admin and bootstrap tenant creation
- headless bootstrap validation
- disabling the setup surface after completion

## 4. Deployment packaging in the repository

The repository currently includes:

- `docker-compose.prod.yml`
- `.env.production.example`
- `install.sh`
- `charts/managecallai/`

These artifacts package the deployment paths but do not prove release readiness by themselves.

## 5. Security constraints

- setup is gated by the sentinel on every startup
- headless bootstrap still goes through API-owned validation rules
- operator-facing setup is removed after completion
- release readiness for these paths requires runtime validation and evidence in release docs, not only design or scripts
