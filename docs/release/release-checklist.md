# Release Checklist

Use this checklist before promoting manageCallAI beyond development or staging.

## Release Classification

| Release | Status | Minimum Gate |
|---|---|---|
| Internal alpha | Allowed | Main CI green, demo loop works locally, runtime proof verified manually |
| Public alpha | Conditional | `docs/release/public-alpha-readiness.md` checklist complete |
| Public beta | Blocked | Self-hosted FreeSWITCH smoke CI, usable visual IVR/HUD, broader isolation/runtime tests |
| Production | Blocked | Runtime E2E release gate, tested deployment/backup/restore/upgrade, fraud controls, soak testing |

Do not describe manageCallAI as production-ready until the production checklist
and release smoke evidence are complete.

## Required Gates

- `pnpm install --frozen-lockfile`
- `pnpm generate:openapi`
- `pnpm db:migrate`
- `pnpm db:contracts`
- `pnpm lint`
- `pnpm build`
- `pnpm test`
- `pnpm test:coverage`
- `pnpm check:migrations`
- `pnpm db:constraints`
- `pnpm check:mcp-schemas`
- `pnpm check:mcp-contracts`
- `pnpm check:webhook-payloads`
- `pnpm check:api-key-capabilities`
- `pnpm check:coverage-ignores`
- `pnpm check:production-readiness`
- `pnpm production:preflight`
- `pnpm restore:smoke` after restore rehearsals
- `pnpm production:e2e` on a runtime-capable environment

## Coverage Gates

Phase 3 target thresholds:

- API: 88-90%
- Web: 80%
- MCP: 85%
- SDK: 90%
- FreeSWITCH agent: 85%

If the package has not reached the Phase 3 target yet, release readiness requires:

- no coverage decrease from the previous release candidate
- critical live-call-impacting paths covered by behavior tests
- a linked follow-up issue for each remaining high-risk gap
- no unapproved coverage ignore comments in critical safety paths

## E2E Gates

Normal CI includes an API-only demo loop (`apps/api/src/demo-loop.e2e.test.ts`) covering tenant
registration, extension creation, IVR validation/simulation/publish, FreeSWITCH dialplan lookup,
call event ingest, and health check.

A self-hosted FreeSWITCH smoke workflow exists at `.github/workflows/freeswitch-smoke.yml`. It:
- Is skipped automatically when the `freeswitch` self-hosted runner label is unavailable
- Is triggered automatically on `release/**` and `rc/**` branches
- Can be triggered manually via `workflow_dispatch`

Every release candidate must document whether the FreeSWITCH smoke was run and what runtime
versions were used. Production release candidates must also attach the sanitized
`pnpm production:e2e` evidence artifact. See `docs/release/production-runtime-e2e.md`.

## Backup, Restore, And Upgrade Gates

Production promotion requires evidence that:

- a PostgreSQL backup was taken before migration
- migrations were applied with `pnpm db:migrate`
- `pnpm db:contracts` and `pnpm db:constraints` passed
- a restore rehearsal or recent restore smoke ran with `pnpm restore:smoke`
- `pnpm production:preflight` passed in the target environment
- `pnpm production:e2e` passed after deployment or restore

## Safety Review

Before release, verify:

- tenant isolation tests cover every tenant-scoped resource touched by the release
- API key wildcard behavior does not grant platform-admin capabilities
- MCP and n8n cannot invoke raw ESL, raw XML, shell, or direct runtime control
- outbound call policy changes include fraud-safety tests
- webhook signing and replay behavior remain covered
- logs and error responses do not expose runtime tokens, SIP secrets, webhook secrets, recordings, or stack traces in production mode
