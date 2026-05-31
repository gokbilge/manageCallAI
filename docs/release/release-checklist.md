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

## Production Slice Gates

Production release candidates must close or explicitly defer all production
readiness slices below. Any deferral must include risk, owner, mitigation, and a
rollback plan.

- `SLICE-52` production runtime E2E gate
- `SLICE-53` production deployment and network hardening
- `SLICE-54` backup, restore, upgrade, and disaster recovery
- `SLICE-55` production fraud, abuse, and rate-limit hardening
- `SLICE-56` production observability, soak tests, and SLOs
- `SLICE-57` production tenant isolation and compliance evidence
- `SLICE-58` production SDK, MCP, n8n, and release packaging
- `SLICE-59` production release candidate governance

## E2E Gates

Normal CI should include an API-only demo loop covering tenant registration, extension creation, IVR validation/simulation/publish, runtime resolution, call event ingest, observability query, and rollback.

FreeSWITCH smoke tests may be optional when they require a self-hosted runner, but every release candidate must document whether the smoke was run and what runtime versions were used.

## Safety Review

Before release, verify:

- tenant isolation tests cover every tenant-scoped resource touched by the release
- API key wildcard behavior does not grant platform-admin capabilities
- MCP and n8n cannot invoke raw ESL, raw XML, shell, or direct runtime control
- outbound call policy changes include fraud-safety tests
- webhook signing and replay behavior remain covered
- logs and error responses do not expose runtime tokens, SIP secrets, webhook secrets, recordings, or stack traces in production mode
