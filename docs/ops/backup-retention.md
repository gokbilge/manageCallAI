# Backup Retention Policy

Retention, encryption, and access requirements for manageCallAI backups.
This document defines the minimum policy for production deployments.

## Policy Summary

| Component | Frequency | Retention | Encrypted | Offsite |
|---|---|---|---|---|
| PostgreSQL full dump | Daily | 30 days | Required | Required |
| PostgreSQL WAL / PITR | Continuous | 7 days | Required | Required |
| Recording media | Daily sync | 90 days | Required | Required |
| Environment secrets | On change | Indefinite | Required (secrets manager) | Required |

## RPO and RTO

| Scenario | Target (alpha) | Target (production) |
|---|---|---|
| Recovery point objective (RPO) | 24 hours | < 1 hour (with WAL) |
| Recovery time objective (RTO) | < 2 hours | < 30 minutes |

## PostgreSQL Backups

### Full dump schedule

Take a daily logical backup using `pg_dump`:

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

### WAL archiving (production)

Configure continuous WAL archiving for point-in-time recovery (PITR):

```ini
# postgresql.conf
archive_mode = on
archive_command = 'aws s3 cp %p s3://your-bucket/wal/%f'
wal_level = replica
```

Retain WAL segments for at least 7 days. Test PITR recovery quarterly.

### Encryption

Encrypt dumps at rest before off-site storage:

```sh
gpg --symmetric --cipher-algo AES256 managecallai-20260601.pgdump
```

For managed databases (RDS, Cloud SQL), enable server-side encryption on the
storage volume and encrypt any exported snapshots.

### Off-site copy

Copy dumps to a storage location in a separate geographic region or cloud
account. Never store backups only on the same host or account as the database.

### Access controls

- Database backup files must not be accessible to the application service account.
- Backup decryption keys must be stored separately from backup files.
- Access to backup storage must be logged and reviewed quarterly.

## Recording Media Backups

Recordings are referenced by `storage_reference` in the `recordings` table.
Back up the recording media directory to object storage daily:

```sh
# cron: 0 3 * * *
aws s3 sync "$RECORDING_STORAGE_ROOT" "s3://your-bucket/recordings/" \
  --storage-class STANDARD_IA \
  --sse AES256
```

Retain recording backups for 90 days minimum, or longer if required by your
legal or compliance obligations. Check jurisdiction-specific data retention laws.

## Environment Secrets

Never include environment secrets in database dumps. Store separately:

- `.env` file contents → secrets manager (HashiCorp Vault, AWS Secrets Manager,
  GCP Secret Manager)
- `JWT_SECRET`, `SIP_SECRET_MASTER_KEY`, `RUNTIME_API_TOKEN` → separate from the
  database so a database compromise does not expose all secrets

See `docs/ops/secret-rotation.md` for secret rotation procedures.

## Restore Rehearsal Frequency

Run a full restore rehearsal at least every 30 days:

```sh
pnpm restore:rehearsal
```

This takes a pg_dump, restores to a temporary database, runs migrations,
contracts, constraints, and restore smoke, and emits a validated evidence JSON.
The evidence JSON must be stored with the release or incident record.

## Compliance and Legal Notes

Telecom call records may be subject to data retention laws in your jurisdiction.
Common requirements include:

- Call detail records (CDRs): 6 months to 7 years depending on jurisdiction.
- Recording media: variable; consult legal counsel before setting retention < 90 days.
- Personal data in call logs: GDPR/CCPA deletion rights must be honored even
  if backup copies exist — document your deletion propagation procedure.

## Policy Validation

Use `pnpm check:backup-retention-policy -- --policy=<path>` to validate a
filled backup-retention-policy JSON against the minimum requirements:

```sh
pnpm check:backup-retention-policy -- \
  --policy=docs/ops/backup-retention-policy.json
```

The canonical production-candidate policy lives at
`docs/ops/backup-retention-policy.json`. Use
`docs/ops/templates/backup-retention-policy-template.json` only as the starting
template for deployment-specific overrides.

## Related Documents

- `docs/ops/backup-restore.md` — backup and restore procedures
- `docs/ops/restore-smoke.md` — restore validation sequence
- `docs/ops/secret-rotation.md` — secret management
