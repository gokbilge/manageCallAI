# Private Migration Contract

Last updated: 2026-06-07.

This document defines the interface contract between the public migration runner
and private commercial/enterprise migration modules. Private modules must follow
this contract to participate in the migration lifecycle.

## Descriptor interface

Each private migration file must be described by a `PrivateMigrationDescriptor`:

```typescript
import type {
  PrivateMigrationDescriptor,
  PrivateSchemaModuleDescriptor,
} from '@managecallai/contracts';
```

```typescript
export interface PrivateMigrationDescriptor {
  id: string;                  // Globally unique — e.g. "commercial-0001"
  moduleId: string;            // Owner module — e.g. "managecallai-commercial"
  edition: "pro" | "enterprise";
  schema: "managecallai_commercial" | "managecallai_enterprise";
  filename: string;            // Migration filename relative to private module
  checksum: string;            // SHA-256 of the migration file content
  description: string;         // Human-readable summary
}
```

A module exposes all its migrations via a `PrivateSchemaModuleDescriptor`:

```typescript
export interface PrivateSchemaModuleDescriptor {
  moduleId: string;
  edition: "pro" | "enterprise";
  requiredSchemas: ("managecallai_commercial" | "managecallai_enterprise")[];
  migrations: PrivateMigrationDescriptor[];
  requiredEntitlements: string[];          // Entitlement keys from public framework
}
```

## Migration ordering rules

1. Private migration IDs within a module must be monotonically ordered and
   applied in that order.
2. Private migrations are applied **after** all public migrations complete.
3. Pro migrations are applied before Enterprise migrations if both are present.
4. The private module is responsible for tracking its own applied migrations in
   a private `schema_migrations` table within its schema.
5. The public migration runner exposes a documented hook for private modules to
   register their descriptor. Private modules must not reach into the public
   `schema_migrations` table.

## Rules for private migration content

| Rule | Detail |
|------|--------|
| Schema namespace | All tables must be in `managecallai_commercial` or `managecallai_enterprise`, never in `public` |
| Core table modifications | Must not ALTER, DROP, or RENAME public core tables without explicit maintainer approval and a public migration to match |
| Extension columns | May add `ext_commercial_*` or `ext_enterprise_*` columns to public tables only via documented extension policy |
| Foreign keys | May reference public table PKs (e.g. `tenant_id REFERENCES public.tenants(id)`) |
| Idempotency | Must use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, etc. |
| Reversibility | Must include rollback notes or a matching down migration |
| Entitlement dependency | Must declare required entitlement keys in the module descriptor |
| Checksum verification | The migration runner must verify the checksum before applying |

## Auditability requirements

Private migrations must appear in private release evidence JSON with:

- module ID
- migration ID and filename
- checksum
- applied-at timestamp
- environment (staging/production)
- operator identity

Private release evidence must be archived in the private commercial/enterprise
release artifact store and linked from the private release issue.

## Public migration runner extension point

The public migration runner (`db/migrate.mjs`) reserves a hook for private
module integration. Future versions will expose:

```typescript
interface MigrationRunnerHooks {
  onPublicMigrationsComplete?(context: MigrationContext): Promise<void>;
  resolvePrivateDescriptors?(): Promise<PrivateSchemaModuleDescriptor[]>;
}
```

Private modules should not monkey-patch the runner. They register a descriptor
and the runner calls the hook after all public migrations have been applied.

Until this hook is implemented, private modules run their own migration CLI
targeting the private schema and record their own evidence.

## Schema creation

Private modules are responsible for creating their own schemas before running
migrations:

```sql
CREATE SCHEMA IF NOT EXISTS managecallai_commercial;
CREATE SCHEMA IF NOT EXISTS managecallai_enterprise;
```

These `CREATE SCHEMA` statements may appear in private module bootstrap or as
the first private migration.

## Related documents

- [`public-vs-private-schema-boundary.md`](./public-vs-private-schema-boundary.md)
- [`private-schema-extension-policy.md`](./private-schema-extension-policy.md)
- [`entitlement-enforcement.md`](./entitlement-enforcement.md)
- [`open-core-architecture.md`](./open-core-architecture.md)
