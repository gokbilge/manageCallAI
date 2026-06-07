# Commercial Repo Skeleton

Last updated: 2026-06-07.

This document defines the intended directory structure for the future private
`gokbilge/manageCallAI-commercial` repository. Nothing in this document is
implemented yet. This is a planning skeleton.

**This repo must remain private. Do not commit private keys, customer data,
or real license files.**

---

## Intended structure

```
manageCallAI-commercial/
│
├── README.md                          # Private — do not publish
├── LICENSE                            # Commercial license terms
├── package.json
├── pnpm-workspace.yaml
│
├── modules/
│   ├── advanced-ai/                   # Advanced AI workflow implementations
│   │   ├── src/
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── ai-gateway/                    # Private AI gateway integration
│   │   ├── src/
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── commercial-usage/              # Pro usage reporting and dashboards
│   │   ├── src/
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── add-on-enforcement/            # Add-on pack server-side enforcement
│   │   ├── src/
│   │   └── package.json
│   │
│   ├── migration-preview/             # Paid migration preview and scoring
│   │   ├── src/
│   │   └── package.json
│   │
│   └── billing-export/                # Commercial billing data export
│       ├── src/
│       └── package.json
│
├── db/
│   └── migrations/
│       └── commercial/                # PostgreSQL managecallai_commercial schema
│           ├── 0001_commercial_schema_init.sql
│           └── README.md
│
├── docker/
│   ├── Dockerfile.commercial          # Pro build overlay
│   └── docker-compose.commercial.yml
│
├── docs/
│   ├── module-integration.md          # How to integrate with public core
│   ├── api-contracts.md               # Commercial API extensions
│   └── release-process.md            # Private release process
│
└── scripts/
    ├── build-commercial.mjs
    └── validate-commercial.mjs
```

---

## Integration contract

Commercial modules integrate with the public core via:

1. **EntitlementService** — call `entitlementSvc.assertWithinLimit()` or
   `entitlementSvc.assertFeature()` before any Pro capability executes.

2. **Module registry** — register via `PrivateSchemaModuleDescriptor` from
   `@managecallai/contracts`.

3. **Migration contract** — commercial migrations run in the
   `managecallai_commercial` schema and follow `PrivateMigrationDescriptor`.

4. **Extension points** — use the `ModuleApiContext` interface to register
   additional API routes into the Fastify app.

---

## Schema rules

- All tables in `db/migrations/commercial/` must be in the
  `managecallai_commercial` PostgreSQL schema.
- May reference public table PKs via foreign keys.
- Must not modify public core tables directly.
- Must not add rows to public `commercial_plans` or `commercial_plan_entitlements`
  without using the documented extension interface.

---

## Security rules

- Do not commit private signing keys.
- Do not commit real customer license files.
- Do not commit real customer data.
- Use secret manager / environment variables for all credentials.

---

## Related documents

- [`private-repo-map.md`](./private-repo-map.md)
- [`../commercial/private-migration-contract.md`](../commercial/private-migration-contract.md)
- [`../commercial/private-schema-extension-policy.md`](../commercial/private-schema-extension-policy.md)
