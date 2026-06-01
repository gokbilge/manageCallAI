# Release Checklist

Use this checklist before promoting manageCallAI beyond development or staging.

## Release Classification

| Release | Status | Minimum Gate |
|---|---|---|
| Internal alpha | Allowed | Main CI green, demo loop works locally, runtime proof verified manually |
| Public alpha | Conditional | `docs/release/public-alpha-readiness.md` checklist complete |
| Public beta | Blocked until gate evidence exists | Self-hosted FreeSWITCH smoke CI required on `release/**` / `rc/**`, usable visual IVR/HUD, broader isolation/runtime tests |
| Production | Blocked | Runtime E2E release gate, tested deployment/backup/restore/upgrade, fraud controls, soak testing |

Do not describe manageCallAI as production-ready until the production checklist
and release smoke evidence are complete.

## Required Gates

- Confirm `CHANGELOG.md` has a target release section or accurate `Unreleased`
  entries for the candidate.
- Confirm GitHub release notes follow `docs/release/release-notes-policy.md`.
- Confirm the SDK version and publish status are stated in the release notes.
- `pnpm install --frozen-lockfile`
- `pnpm generate:openapi`
- `node scripts/check-openapi-coverage.mjs`
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
- `pnpm check:log-redaction`
- `pnpm production:preflight`
- `pnpm check:network-config`
- `pnpm check:freeswitch-hardening`
- `pnpm check:runtime-token-rotation`
- `pnpm production:rate-limit-check`
- `./scripts/local-runtime-release-gate.sh` on a runtime-capable machine, OR
  passing `FreeSWITCH runtime smoke` workflow on self-hosted runner
- `pnpm check:runtime-e2e-evidence -- --dir=artifacts/production-e2e`
- `pnpm restore:smoke` after restore rehearsals
- `pnpm production:e2e` on a runtime-capable environment
- `pnpm production:soak` on a runtime-capable environment
- `pnpm production:slo-check -- --evidence=<sanitized-runtime-slo-evidence.json>`
- `pnpm carrier:interop-check -- --evidence=<sanitized-carrier-evidence.json>`
- `pnpm check:sip-tls-srtp-nat-evidence -- --evidence=<sanitized-sip-tls-srtp-nat-evidence.json>`
- `pnpm release:evidence-check -- --manifest=<sanitized-release-evidence.json>`

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

The `.github/workflows/freeswitch-smoke.yml` workflow:

- Runs on `[self-hosted, freeswitch]`
- **Starts** the runtime stack with `docker compose --profile freeswitch up -d --build`
- Runs all 11 smoke proof steps
- **Validates** the evidence artifact with `check-runtime-e2e-evidence.mjs`
- **Tears down** the stack with `docker compose --profile freeswitch down -v`
- Uploads `freeswitch-smoke-<run_id>` artifact (retained 90 days)
- Triggers on: `workflow_dispatch`, push to `release/**`/`rc/**`, PR targeting those branches

The `Release and RC smoke gate` repository ruleset requires the `FreeSWITCH runtime smoke`
status check on `release/**` and `rc/**`. A pending, skipped, or failing check
blocks release promotion.

### Self-hosted runner setup

1. Register a runner with labels `[self-hosted, freeswitch]`
2. Add GitHub Actions secrets:
   - `SMOKE_DATABASE_URL`
   - `SMOKE_JWT_SECRET`
   - `SMOKE_RUNTIME_API_TOKEN`
   - `SMOKE_SIP_SECRET_MASTER_KEY`
   - `SMOKE_FREESWITCH_ESL_PASSWORD`
3. Ensure ports 5060/udp, 5080/tcp, 5080/udp, 8021/tcp, 3000/tcp, 5432/tcp are free

### Local equivalent

```bash
./scripts/local-runtime-release-gate.sh
pnpm check:runtime-e2e-evidence -- --dir=artifacts/production-e2e
```

Every release candidate must document the passing smoke run, runtime versions, and
evidence JSON path. See `docs/release/production-runtime-e2e.md` for requirements.

## Load, Rate Limit, And Carrier Gates

Production promotion requires:

- `pnpm production:soak` evidence from the target release topology
- `pnpm production:slo-check -- --evidence=<file>` passing for runtime lookup endpoints
- `pnpm production:rate-limit-check` passing with shared or edge-enforced rate limiting for multi-instance API deployments
- `pnpm carrier:interop-check -- --evidence=<file>` passing for each supported carrier profile
- `pnpm release:evidence-check -- --manifest=<file>` passing for the production promotion bundle
- documented exceptions for carrier features that are intentionally unsupported

Do not treat check-config mode as production evidence. Check-config mode only proves that release scripts and documentation are wired correctly.

## Backup, Restore, And Upgrade Gates

Production promotion requires evidence that:

- a PostgreSQL backup was taken before migration
- migrations were applied with `pnpm db:migrate`
- `pnpm db:contracts` and `pnpm db:constraints` passed
- a restore rehearsal ran and passed `pnpm restore:smoke`
- `pnpm production:preflight` passed in the target environment
- `pnpm production:e2e` passed after deployment or restore

Run a full automated rehearsal with:

```sh
pnpm restore:rehearsal
```

This takes a pg_dump, restores to a temporary database, runs migrations,
`db:contracts`, `db:constraints`, and `restore:smoke`, then writes and validates
a restore-evidence JSON to `artifacts/restore/`. Requires `pg_dump`, `pg_restore`,
and `psql` in PATH.

To validate an existing evidence artifact:

```sh
pnpm restore:evidence-check -- --evidence=artifacts/restore/restore-evidence-<timestamp>.json
```

Use `docs/ops/templates/restore-evidence-template.json` to fill in evidence
manually for environments where the rehearsal script cannot run directly.
The validator rejects missing required fields, unmasked passwords, and boolean
gates that are not set to `true`.

See `docs/ops/backup-restore.md` for the full restore procedure.

## Safety Review

Before release, verify:

- tenant isolation tests cover every tenant-scoped resource touched by the release
- API key wildcard behavior does not grant platform-admin capabilities
- MCP and n8n cannot invoke raw ESL, raw XML, shell, or direct runtime control
- outbound call policy changes include fraud-safety tests
- `/api/v1/fraud/outbound-policy` changes are capability-gated and audited where they affect live call behavior
- `/api/v1/platform/nodes` token creation and rotation flows return raw secrets once and never log them
- webhook signing and replay behavior remain covered
- logs and error responses do not expose runtime tokens, SIP secrets, webhook secrets, recordings, or stack traces in production mode
