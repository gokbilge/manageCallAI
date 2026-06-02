# Upgrade and Migration Rehearsal Evidence

This document records the upgrade rehearsal required before production promotion (issue #140).

For production release-candidate restore evidence, use
`pnpm restore:rehearsal -- --require-rc` and validate with
`pnpm restore:evidence-check -- --require-rc --evidence=<file>`. The evidence
must identify the release version, full commit SHA, target host, source backup,
operator, and non-development environment.

---

## Rehearsal Procedure

Run on a staging environment with existing tenant data before any production upgrade.

### 1. Pre-upgrade snapshot

```sh
# Record current state
pnpm db:contracts            # confirm contracts pass before upgrade
git describe --tags HEAD     # record source version
psql $DATABASE_URL -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 5;"
```

### 2. Apply migrations

```sh
pnpm db:migrate
```

Confirm output: all pending migrations applied, `No pending migrations` at end.

### 3. Post-migration health check

```sh
# API health
curl -sf http://localhost:3000/health | jq .

# DB contracts (schema must still satisfy all constraints)
pnpm db:contracts

# Build (type check against migrated schema)
pnpm build
```

### 4. Functional smoke

```sh
# Run the demo loop against the upgraded environment
pnpm test -- --reporter=verbose
```

### 5. Rollback rehearsal

If anything in steps 2–4 fails, restore from the pre-upgrade backup:

```sh
# See docs/ops/backup-restore.md for full procedure
pg_restore -d $DATABASE_URL --clean pre_upgrade_backup.dump
pnpm db:contracts  # confirm restore
```

---

## Evidence Record Template

Copy this template and fill it in for each rehearsal:

```json
{
  "release_version": "v0.2.0-rc.1",
  "commit_sha": "<full 40-character commit SHA>",
  "rehearsal_date": "YYYY-MM-DDTHH:MM:SSZ",
  "source_version": "v0.X.Y",
  "target_version": "v0.X.Z",
  "environment": "staging",
  "data_present": true,
  "pre_upgrade": {
    "db_contracts": "pass",
    "schema_migration_version": "0XXX"
  },
  "migration_apply": {
    "result": "pass",
    "migrations_applied": ["0XXX_migration_name.sql"],
    "duration_seconds": 0
  },
  "post_migration": {
    "health_check": "pass",
    "db_contracts": "pass",
    "build": "pass",
    "test_run": "pass"
  },
  "rollback": {
    "triggered": false,
    "reason": null,
    "rollback_result": null,
    "post_rollback_db_contracts": null
  },
  "signoff": {
    "operator": "",
    "signed_at": "YYYY-MM-DDTHH:MM:SSZ",
    "notes": ""
  }
}
```

---

## Status

| Version | Date | Result | Operator |
|---|---|---|---|
| v0.2.0-alpha | Pending | — | — |

Rehearsal must be completed and evidence committed before production promotion (see `docs/release/release-checklist.md`).

---

## Related

- `docs/ops/backup-restore.md` — Backup and restore procedures
- `docs/ops/production-deployment.md` — Full upgrade playbook
- `docs/release/release-checklist.md` — Release gate: requires upgrade rehearsal evidence
