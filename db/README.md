# Database Migrations

This directory contains the PostgreSQL schema baseline and future migrations for `manageCallAI`.

## Layout

- `migrations/`
  Ordered SQL migrations. These are the canonical database change history.

## Rules

- Add schema changes as new ordered migration files.
- Do not edit an already-applied migration in a real environment.
- Keep `docs/design/database-schema.md` aligned with the migration history.

## Current Baseline

- [migrations/0001_initial_schema.sql](migrations/0001_initial_schema.sql)
- [migrations/0002_add_user_password.sql](migrations/0002_add_user_password.sql)

`0001_initial_schema.sql` now includes the tenant directory-domain and per-extension SIP credential columns required by the runtime directory flow.

## Running Migrations

1. Copy `.env.example` to `.env` if you need local overrides.
2. Start PostgreSQL:
   `pnpm db:up`
3. Apply pending migrations:
   `pnpm db:migrate`
4. Check migration status:
   `pnpm db:status`

The migration runner applies files in lexical order and records them in the `schema_migrations` table.
