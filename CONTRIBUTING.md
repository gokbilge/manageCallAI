# Contributing

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

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
5. Wait for required GitHub checks and CODEOWNERS review before merge.

`main` is protected. Do not use direct commits or direct pushes to `main` as the
standard workflow. Use branch, draft pull request, CI, review, and GitHub merge.

Commits, PR text, issue comments, release notes, and audit-linked issues should
use the configured maintainer or contributor identity. Do not add AI-agent names
or generated-by footers to repository history or GitHub comments.

See [docs/development/github-workflow.md](docs/development/github-workflow.md).

## Monorepo Layout

- `apps/` contains deployable applications and services.
- `packages/` contains shared libraries.
- `freeswitch/` contains minimal switch-side integration assets.
- `db/` contains database migrations.
- `docs/` contains requirements, architecture, design, and ADRs.
