# Backup and Restore

This runbook covers PostgreSQL backup, recording storage backup, and restore
procedures for manageCallAI.

This is an alpha-stage operational guide. Adapt it to your deployment topology.
Production deployments should add automated snapshots, off-site replication,
and RTO/RPO tracking.

## What to Back Up

| Component | Data | Priority |
|---|---|---|
| PostgreSQL | All tenant configuration, events, audit records | Critical |
| Recording storage | Audio files referenced by `recordings` table | High |
| Environment secrets | `.env` file contents | Critical — keep separately from DB |

## PostgreSQL Backup

### Full dump

```sh
pg_dump \
  --format=custom \
  --no-acl \
  --no-owner \
  "$DATABASE_URL" \
  > "managecallai-$(date +%Y%m%d-%H%M%S).pgdump"
```

`--format=custom` produces a compressed binary dump that supports
parallel restore with `pg_restore -j`.

### Verify the dump

```sh
pg_restore --list managecallai-<timestamp>.pgdump | head -20
```

### Automated nightly snapshot

```sh
# cron: 0 2 * * *
pg_dump \
  --format=custom \
  --no-acl \
  --no-owner \
  "$DATABASE_URL" \
  > "/backups/managecallai-$(date +%Y%m%d).pgdump"

# Prune backups older than 30 days
find /backups -name "managecallai-*.pgdump" -mtime +30 -delete
```

### Continuous WAL archiving (production)

For production, configure `archive_mode = on` and `archive_command` in
`postgresql.conf` to stream WAL segments to object storage. This provides
point-in-time recovery (PITR) capability.

## Recording Storage Backup

Recordings are referenced by `storage_reference` in the `recordings` table.
The format depends on your `RECORDING_STORAGE_ROOT` setting.

### Sync to object storage

```sh
# Example: sync to S3-compatible store
aws s3 sync "$RECORDING_STORAGE_ROOT" "s3://your-bucket/recordings/" \
  --exclude "*.tmp" \
  --storage-class STANDARD_IA
```

### Verify references

Before backup, confirm all active recording references resolve:

```sh
psql "$DATABASE_URL" -c "
SELECT COUNT(*) AS total,
       SUM(CASE WHEN status = 'stored' THEN 1 ELSE 0 END) AS stored
FROM recordings
WHERE status != 'deleted';"
```

## Restore Procedure

### 1. Stop the API and worker

Prevent writes during restore:

```sh
# Docker Compose
docker-compose stop api worker

# Process manager
systemctl stop managecallai-api managecallai-worker
```

### 2. Drop and recreate the database

```sh
psql "$POSTGRES_ADMIN_URL" -c "DROP DATABASE IF EXISTS managecallai;"
psql "$POSTGRES_ADMIN_URL" -c "CREATE DATABASE managecallai OWNER managecallai;"
```

### 3. Restore from dump

```sh
pg_restore \
  --dbname "$DATABASE_URL" \
  --no-acl \
  --no-owner \
  --jobs 4 \
  managecallai-<timestamp>.pgdump
```

### 4. Apply any migrations newer than the backup

If the codebase has migrations not yet in the backup:

```sh
pnpm db:migrate
```

Verify:

```sh
pnpm db:contracts
pnpm db:constraints
```

### 5. Restore recording files

```sh
aws s3 sync "s3://your-bucket/recordings/" "$RECORDING_STORAGE_ROOT"
```

### 6. Restart services

```sh
docker-compose start api worker
```

### 7. Restore and runtime smoke tests

```sh
pnpm db:contracts
pnpm db:constraints
pnpm restore:smoke
pnpm production:preflight
```

If the restored environment is allowed to run live runtime checks, run:

```sh
pnpm production:e2e
```

Verify:

- API returns 200 on `/health`
- Tenant login works
- Extension list returns expected data
- IVR flow list returns expected data
- FreeSWITCH directory and dialplan lookup work
- runtime call-event ingest and tenant query work

## Verification After Restore

```sh
# Confirm tenant count
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM tenants WHERE status = 'active';"

# Confirm migration state
psql "$DATABASE_URL" -c "SELECT filename FROM schema_migrations ORDER BY applied_at DESC LIMIT 5;"

# Confirm no orphaned recording references
psql "$DATABASE_URL" -c "
SELECT COUNT(*) FROM recordings r
WHERE r.status = 'stored'
  AND r.storage_reference IS NOT NULL;"
```

## Secrets

Never include database dumps in the same backup as environment secrets. Store:

- `.env` file: in a secrets manager (HashiCorp Vault, AWS Secrets Manager, etc.)
- Database dumps: in encrypted object storage
- Keep `JWT_SECRET`, `SIP_SECRET_MASTER_KEY`, and `RUNTIME_API_TOKEN` separate
  from the database so a database compromise does not immediately expose all secrets

## Key Rotation After Restore

If you restore from a backup that predates a key rotation:

1. Identify which `SIP_SECRET_KEY_ID` the backup was taken under
2. Ensure that key version is still in your key store
3. If needed, decrypt old SIP passwords with the old key version before
   re-encrypting with the new one

The `sip_password_key_id` column in `sip_trunks` and `extensions` tracks which
key version was used.

## RTO and RPO Targets (Alpha)

| Scenario | Target (alpha) |
|---|---|
| Full restore from daily backup | < 2 hours |
| Recovery point objective (RPO) | 24 hours (daily backups) |
| Production target | RTO < 30 min, RPO < 1 hour with WAL streaming |

## Related Documents

- `docs/ops/production-deployment.md` — environment setup
- `docs/ops/restore-smoke.md` — restore verification gate
- `docs/development/release-runbook.md` — upgrade and rollback procedures
- `docs/release/release-checklist.md` — backup/restore gate in production checklist
