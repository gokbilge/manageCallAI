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

## Contributor Licensing

Contributions to this repository are made under the repository's active license
(currently **Apache License, Version 2.0**) unless otherwise explicitly stated.

By submitting a contribution you certify that:

1. You have the right to submit the contribution under the active license.
2. The contribution is your original work, or you have the right to submit it
   on behalf of the original author.
3. The contribution does not include secrets, proprietary third-party code, or
   license-incompatible code.
4. You are not submitting code owned by your employer without appropriate rights.

**Future CLA or DCO requirement:** The project is evaluating a commercial
packaging model starting in v0.7.5. Before any license change (e.g., moving to
AGPL-3.0 or a commercial dual-license model), maintainers may require a
Contributor License Agreement (CLA) or Developer Certificate of Origin (DCO)
sign-off. This will be announced with adequate notice before it takes effect.

See [`docs/commercial/contributor-license-policy.md`](docs/commercial/contributor-license-policy.md)
for context on why this matters.

## Monorepo Layout

- `apps/` contains deployable applications and services.
- `packages/` contains shared libraries.
- `freeswitch/` contains minimal switch-side integration assets.
- `db/` contains database migrations.
- `docs/` contains requirements, architecture, design, and ADRs.
