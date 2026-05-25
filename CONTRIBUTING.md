# Contributing

## Principles

- Keep business logic in the `manageCallAI` backend.
- Keep FreeSWITCH integration logic outside stock FreeSWITCH whenever possible.
- Keep Lua thin and execution-focused.
- Update relevant docs and ADRs in the same change when architecture or interfaces shift.

## Development Workflow

1. Create a focused branch.
2. Update or add tests where practical.
3. Update docs when behavior, contracts, or architecture changes.
4. Open a pull request with a clear summary and risk notes.

## Monorepo Layout

- `apps/` contains deployable applications and services.
- `packages/` contains shared libraries.
- `freeswitch/` contains minimal switch-side integration assets.
- `db/` contains database migrations.
- `docs/` contains requirements, architecture, design, and ADRs.
