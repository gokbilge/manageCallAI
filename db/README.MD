# Database Migrations

This directory contains the PostgreSQL schema baseline and future migrations for `manageCallAI`.

## Layout

- `migrations/`
  Ordered SQL migrations. These are the canonical database change history.

## Rules

- Add schema changes as new ordered migration files.
- Do not edit an already-applied migration in a real environment.
- Keep `docs/DatabaseSchema.md` aligned with the migration history.

## Current Baseline

- [migrations/0001_initial_schema.sql](migrations/0001_initial_schema.sql)
