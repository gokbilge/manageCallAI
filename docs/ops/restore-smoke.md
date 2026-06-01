# Restore Smoke Verification

Run restore smoke after restoring PostgreSQL from backup and before allowing
FreeSWITCH runtime traffic back onto the deployment.

```sh
pnpm restore:smoke
```

Required environment:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Restored database connection string |

## What It Checks

- database connectivity
- critical desired-state tables exist
- `schema_migrations` has migration history
- active tenants are queryable
- `flow_versions` still reference existing `ivr_flows`

This is intentionally fast and conservative. It does not prove the whole product
works; it proves the restored database is coherent enough to proceed to contract,
constraint, runtime, and UI checks.

## Automated Rehearsal

Run the full backup → restore → migrate → validate cycle in one step:

```sh
pnpm restore:rehearsal
```

This requires `pg_dump`, `pg_restore`, and `psql` in PATH. It restores into a
temporary database, runs all checks, and writes a validated evidence JSON to
`artifacts/restore/`.

## Restore Validation Sequence

For a manual restore or when the rehearsal script cannot run directly:

```sh
pnpm db:contracts
pnpm db:constraints
pnpm restore:smoke
pnpm production:preflight
pnpm production:e2e
```

For a production release or disaster recovery exercise, store command output and
`artifacts/production-e2e/*.json` with the incident or release record.

## Failure Handling

If restore smoke fails:

- keep API and worker writes stopped
- do not reconnect FreeSWITCH runtime traffic
- inspect the failed table or relationship
- restore from a newer backup or replay WAL if available
- rerun the full validation sequence before reopening traffic
