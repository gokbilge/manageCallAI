# Enterprise Model Upgrade and Release Guidance

This document covers upgrade, rollback, and operator guidance for the enterprise
model changes introduced across the v0.6.3–v0.6.8 release line. Read this
before upgrading any installation from v0.6.2 or earlier.

Issue: #318 — v0.7.0: enterprise model upgrade and release guidance

---

## What Changed

The v0.6.3–v0.6.8 slices introduced a set of enterprise-grade domain objects
that operate as new desired-state entities alongside the existing IVR, routing,
and extension model.

| Release | Migrations | New Domain Objects |
|---------|-----------|-------------------|
| v0.6.3 | 0063 | Numbering plans, calling policies, outbound permission model |
| v0.6.4 | 0064 | Sites, locations, site-aware emergency and dialing defaults |
| v0.6.5 | 0065 | Trunk groups, route lists, failover-aware carrier selection |
| v0.6.6 | 0066 | Devices, registrations, user-extension-device separation |
| v0.6.7 | *(schedule-group migration, see #311)* | Schedule groups, holiday calendars, override and expiry |
| v0.6.8 | 0067 | Line appearances, device appearance assignments |

All migrations are additive. No existing tables are dropped or column types changed.
Existing tenants continue to function without any of the new domain objects configured.

---

## Upgrade Procedure

### 1. Pre-upgrade snapshot

```sh
pnpm db:contracts            # confirm all constraints pass before upgrade
git describe --tags HEAD     # record source version
psql $DATABASE_URL -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 5;"
```

### 2. Apply migrations

```sh
pnpm db:migrate
```

Expected output: all pending migrations applied in sequence (0063 → 0067 for
a v0.6.2 → v0.7.0 upgrade). Confirm `No pending migrations` at the end.

### 3. Post-migration health check

```sh
pnpm build          # type-check against migrated schema
pnpm db:contracts   # all constraints still satisfied
pnpm test           # full test suite green
```

### 4. Verify enterprise model endpoints

```sh
# Create a test site to confirm schema is readable
curl -sf -H "Authorization: Bearer $JWT" \
  http://localhost:3000/api/v1/sites | jq .

# Verify trunk-group listing
curl -sf -H "Authorization: Bearer $JWT" \
  http://localhost:3000/api/v1/trunk-groups | jq .
```

### 5. Run production soak

```sh
pnpm production:soak
pnpm production:slo-check -- --evidence=artifacts/release/runtime-slo.json
```

---

## New Configuration Required

None of the enterprise model features require configuration to be present for
the system to start or for existing tenants to operate. Configuration is
opt-in per tenant.

However, to **use** the enterprise features, operators must configure:

### Trunk Groups (v0.6.5)

Site-aware outbound carrier selection requires at least one trunk group with
an associated route list. Without a trunk group, outbound routing falls back
to the default trunk selection behavior from v0.6.2 and earlier.

```sh
POST /api/v1/trunk-groups
{
  "name": "primary-group",
  "trunk_ids": ["<trunk-id>"],
  "selection_mode": "priority"
}
```

Run failover simulation before enabling in production:

```sh
POST /api/v1/trunk-groups/{id}/simulate
```

### Sites and Locations (v0.6.4)

Site assignments on extensions enable site-aware emergency routing. Without
site assignments, emergency routing falls back to the tenant-level default.

### Line Appearances (v0.6.8)

Line appearance assignments are optional. If unused, extension registration
behavior is unchanged from v0.6.2. When assigned, line appearances create
additional SIP registration namespaces in FreeSWITCH; verify that FreeSWITCH
external profile is configured to handle the additional registration load.

### Schedule Groups (v0.6.7)

Schedule groups and holiday calendars enable time-based routing overrides.
Without schedule groups, time-based routing from v0.6.2 (the `schedules` table
from migration 0014) continues to operate unchanged.

---

## Rollback

All migrations are additive. A rollback to v0.6.2 requires:

1. Stop the API service.
2. Restore from the pre-upgrade database snapshot:
   ```sh
   pg_restore -d $DATABASE_URL --clean pre_upgrade_backup.dump
   pnpm db:contracts  # confirm restore
   ```
3. Deploy the v0.6.2 image.
4. Restart the API service.

**Data loss on rollback:** Any enterprise model objects created after the
upgrade (sites, trunk groups, line appearances, schedule groups, numbering
plans) will be lost on rollback. Export any critical configuration before
rolling back.

**FreeSWITCH state on rollback:** Line appearance registration namespaces
created during the upgrade will become stale after rollback. Run
`pnpm generate:freeswitch-config` against the restored v0.6.2 database to
regenerate the FreeSWITCH directory and dialplan to the pre-upgrade state.

---

## Operator Checklist

Before promoting v0.7.0 to production:

- [ ] Pre-upgrade database snapshot taken and verified restorable
- [ ] Migrations 0063–0067 applied cleanly on the target environment
- [ ] `pnpm db:contracts` passes after migration
- [ ] `pnpm build` succeeds after migration
- [ ] Full test suite green
- [ ] Production soak run; SLO thresholds met (see `docs/ops/runtime-slo-evidence-2026-06-07.json`)
- [ ] Carrier interop evidence reviewed (see `docs/ops/carrier-interop-evidence-v0.7.0.json`)
- [ ] Rotation rehearsal completed (see `docs/ops/rotation-rehearsal-2026-06-07.json`)
- [ ] Any trunk-group configurations validated via failover simulation
- [ ] Line appearance extensions verified on FreeSWITCH registration (if feature is used)
- [ ] Rollback snapshot retained for at least 30 days post-upgrade

---

## Architecture Boundaries

The enterprise model changes respect the existing architecture rules:

- **API owns lifecycle** — all enterprise objects (sites, trunk groups, line
  appearances, schedule groups) are created, validated, and published through
  the API. FreeSWITCH never learns about these objects directly.
- **PostgreSQL is source of truth** — all enterprise object state is stored in
  PostgreSQL. FreeSWITCH configuration is derived from this state at publish time.
- **FreeSWITCH remains stock** — no Lua or ESL changes were required for any
  of the v0.6.3–v0.6.8 enterprise features.
- **Tenant isolation maintained** — all enterprise objects are tenant-scoped.
  Cross-tenant access is blocked at the repository layer.
- **Simulation before publish** — trunk-group failover simulation (v0.6.5) and
  schedule-aware route simulation (v0.6.7) must pass before enterprise routing
  changes can be published to the live call path.

---

## References

- `docs/ops/carrier-interop-evidence-v0.7.0.json` — carrier interop gate (#316)
- `docs/ops/runtime-slo-evidence-2026-06-07.json` — soak/SLO gate (#317)
- `docs/ops/rotation-rehearsal-2026-06-07.json` — rotation rehearsal gate (#317)
- `docs/release/evidence-inheritance-policy.md` — inheritance policy and re-run schedule
- `docs/ops/backup-restore.md` — backup and restore procedures
- `docs/ops/upgrade-rehearsal-evidence.md` — upgrade rehearsal evidence template
