# Release Checklist

Use this checklist before promoting manageCallAI beyond development or staging.

## Release Classification

| Release | Status | Minimum Gate |
|---|---|---|
| Internal alpha | Allowed | Main CI green, demo loop works locally, runtime proof verified manually |
| Public alpha | Complete for `v0.2.0-alpha` | `docs/release/public-alpha-readiness.md` checklist complete |
| Public beta candidate | Current stage | Beta implementation present, but beta evidence must be current for the candidate |
| Public beta ready | Blocked until gate evidence exists | Self-hosted FreeSWITCH smoke evidence tied to the beta candidate, SDK dry-run/publish evidence, verified MCP/n8n/webhook workflows, usable visual IVR/HUD evidence, coverage evidence |
| Production release candidate | Blocked | Release evidence manifest with RC commit, CI/security/coverage/runtime/restore/soak/SLO/carrier/rate-limit artifacts, rollback plan, and operator signoff fields populated |
| Production | Blocked | Production RC evidence bundle passes and operator signoff is complete |

Do not describe manageCallAI as production-ready until the production checklist
and release smoke evidence are complete.

## Stage Gate Separation

| Gate | Internal alpha | Public alpha | Public beta | Production RC | Production |
|---|---|---|---|---|---|
| Main CI | required | required | required | required | required |
| Clean-clone demo | recommended | evidenced | evidenced | evidenced | evidenced |
| FreeSWITCH smoke | manual acceptable | feature-branch evidence acceptable | candidate-bound evidence required | RC-bound evidence required | RC-bound evidence required |
| SDK publish/dry run | not required | not required | required | required | required |
| MCP/n8n workflow proof | documented | documented | evidenced | evidenced | evidenced |
| Restore/upgrade | documented | documented | documented | evidenced | evidenced |
| Soak/SLO/load | not required | lab evidence acceptable | lab/candidate evidence | RC evidence required | RC evidence required |
| Carrier interop | documented | lab/live evidence acceptable | candidate evidence | RC evidence required | RC evidence required |
| Retention/legal hold | documented | implemented | implemented and tested | evidenced including storage/export gaps | evidenced |
| Operator signoff | not required | not required | recommended | required | required |

Check-config mode may verify script wiring for normal CI, but it never satisfies
a live release evidence gate.

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
- `pnpm check:runtime-token-rotation -- --evidence=artifacts/rotation/rotation-rehearsal-<timestamp>.json`
- `pnpm production:rate-limit-check`
- `./scripts/local-runtime-release-gate.sh` on a runtime-capable machine, OR
  passing `FreeSWITCH runtime smoke` workflow on self-hosted runner
- `pnpm check:runtime-e2e-evidence -- --dir=artifacts/production-e2e`
- `pnpm restore:smoke` after restore rehearsals
- `pnpm check:backup-retention-policy -- --policy=<backup-retention-policy.json>`
- `pnpm production:e2e` on a runtime-capable environment
- `pnpm production:soak` on a runtime-capable environment
- `pnpm production:slo-check -- --evidence=<sanitized-runtime-slo-evidence.json>`
- `pnpm carrier:interop-check -- --evidence=<sanitized-carrier-evidence.json>`
- `pnpm check:sip-tls-srtp-nat-evidence -- --evidence=<sanitized-sip-tls-srtp-nat-evidence.json>`
- `pnpm release:evidence-check -- --manifest=<sanitized-release-evidence.json>`

## Version Tags And GitHub Releases

Create tags only from the protected `main` branch after the required gates for
the release classification pass.

| Channel | Tag pattern | GitHub release setting |
|---|---|---|
| Internal alpha | `v0.1.0-internal-alpha.N` | Draft or prerelease |
| Public alpha | `v0.1.0-alpha.N` | Prerelease |
| Public beta | `v0.2.0-beta.N` | Prerelease |
| Release candidate | `v0.2.0-rc.N` | Prerelease |
| Production | `v1.0.0` and later | Full release |

Tagging procedure:

1. Move completed `CHANGELOG.md` entries from `Unreleased` to the target
   version heading.
2. Run the required gates above on the exact commit to be tagged.
3. Create an annotated tag:

   ```sh
   git tag -a v0.1.0-alpha.1 -m "v0.1.0-alpha.1"
   git push origin v0.1.0-alpha.1
   ```

4. Create the GitHub release as a prerelease for alpha, beta, or RC channels.
5. Attach or link sanitized evidence artifacts required by the channel.
6. Confirm Docker and SDK publish workflows either completed or are explicitly
   documented as not exercised for the release.

Do not move public tags. If validation fails after a tag is published, cut the
next numbered prerelease tag.

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

For production RC evidence, require candidate metadata:

```sh
RESTORE_RELEASE_VERSION=<rc-version> \
RESTORE_TARGET_HOST=<target-host> \
RESTORE_ENVIRONMENT=rc \
RESTORE_OPERATOR="<operator>" \
pnpm restore:rehearsal -- --require-rc
```

To validate an existing evidence artifact:

```sh
pnpm restore:evidence-check -- --evidence=artifacts/restore/restore-evidence-<timestamp>.json
pnpm restore:evidence-check -- --evidence=artifacts/restore/restore-evidence-<timestamp>.json --require-rc
```

Use `docs/ops/templates/restore-evidence-template.json` to fill in evidence
manually for environments where the rehearsal script cannot run directly.
The validator rejects missing required fields, unmasked passwords, and boolean
gates that are not set to `true`.

See `docs/ops/backup-restore.md` for the full restore procedure.

## PBX Completeness Gates (add when features are implemented)

When PBX Completeness Layer features are implemented, add the following to the
production evidence checklist for each feature:

| Feature | Required evidence gate |
|---|---|
| Feature codes | Passing DTMF smoke run on self-hosted runner with audit event proof |
| Call parking | Passing valet_park smoke with Go agent event ingestion proof |
| Native conferencing | Passing mod_conference two-caller smoke |
| Gateway reload | Passing trunk change → REGED confirmation smoke on self-hosted runner |
| Self-service portal | Integration test matrix: end_user isolation, policy gating, PIN redaction |
| Runtime management | Passing reloadxml/rescan action smoke with approval gate proof |

These gates are **not required** for the current public beta stage.
They apply only when the corresponding features ship.

## Safety Review

Before release, verify:

- tenant isolation tests cover every tenant-scoped resource touched by the release
- API key wildcard behavior does not grant platform-admin capabilities
- MCP and n8n cannot invoke raw ESL, raw XML, shell, or direct runtime control
- outbound call policy changes include fraud-safety tests
- `/api/v1/fraud/outbound-policy` changes are capability-gated and audited where they affect live call behavior
- `/api/v1/platform/nodes` token creation and rotation flows return raw secrets once and never log them
- secret and runtime token rotation rehearsal evidence validates old-token rejection, audit events, and log-redaction linkage
- webhook signing and replay behavior remain covered
- logs and error responses do not expose runtime tokens, SIP secrets, webhook secrets, recordings, or stack traces in production mode
