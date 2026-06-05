# Release Checklist

Use this checklist before promoting manageCallAI beyond development or staging.

## Release Classification

| Release | Status | Minimum Gate |
|---|---|---|
| Internal alpha | Allowed | Main CI green, demo loop works locally, runtime proof verified manually |
| Public alpha | Complete for `v0.2.0-alpha` | `docs/release/public-alpha-readiness.md` checklist complete |
| Public beta candidate | Complete ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â `v0.2.0-beta.1` | Beta implementation present and evidenced |
| Public beta ready | Complete ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â `v0.2.0-beta.1` | FreeSWITCH smoke run 26825030902, SDK dry-run, MCP/n8n/webhook evidenced |
| Production release candidate | Complete ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â `v0.3.0-rc.1` | Smoke run 26903877370 on `rc/v0.3.0`, evidence manifest passes `pnpm release:evidence-check` |
| **Production** | **Current: `v0.6.0`** (2026-06-05) | All Category A gates re-run per release. Category B gates inherited per `docs/release/evidence-inheritance-policy.md`. |

Latest evidenced production tag: **v0.6.0** (2026-06-05).
Evidence: `docs/release/release-evidence-v0.6.0.json`
Product audit: `docs/release/product-release-audit-v0.6.0.md`
Evidence inheritance policy: `docs/release/evidence-inheritance-policy.md`

Release history:
- v0.6.0 — AI-native differentiation (2026-06-05)
- v0.5.0 — operational maturity (2026-06-05)
- v0.4.0 — competitive baseline (2026-06-05)
- v0.3.5 — setup/bootstrap/deployment packaging (2026-06-04)
- v0.3.0 — first full production release (2026-06-03)

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
- a restore rehearsal ran and passed `pnpm restore:smoke` (DB-level: dump ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢
  restore ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ migrations ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ contracts ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ constraints)
- `pnpm production:preflight` passed on the target environment (separate
  evidence from the restore rehearsal; preflight validates production
  env vars and security config, not DB restore integrity)
- `pnpm production:e2e` passed on the target environment (verified separately
  from restore; the production E2E smoke run proves runtime operation, not
  DB snapshot integrity)

Note: restore rehearsal and production E2E are complementary, not duplicate.
The restore rehearsal proves data survives a snapshot/restore cycle. The
production E2E proves the system operates correctly. For v0.3.0:
- Restore evidence: `docs/ops/restore-evidence-enlogy-2026-06-02.json`
  (`restore_smoke_passed=true`, `db_contracts_passed=true`,
  `db_constraints_passed=true`; preflight and E2E verified separately)
- Production E2E: smoke run 26903877370 (all 11 steps passed)

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

## PBX Completeness Gates

PBX Completeness Layer features are implemented. The following evidence gates
apply before any PBX feature is promoted to production:

| Feature | Status | Required evidence gate |
|---|---|---|
| Gateway reload (#175) | Implemented | Trunk PATCH ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Go agent ESL commands ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ gateway REGED state confirmed on self-hosted runner |
| Feature codes (#172) | Implemented | DTMF code dialed ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Lua executor ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ API callback ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ audit event written ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â smoke on self-hosted runner |
| Call parking (#173) | Implemented | `valet_park` smoke: call parked, Go agent CHANNEL_PARK event ingested, slot retrieved ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â smoke on self-hosted runner |
| Conferencing (#174) | Implemented | `mod_conference` two-caller smoke: PIN enforced, callers bridged ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â smoke on self-hosted runner |
| Self-service portal (#176) | Implemented | Integration test matrix: `end_user` isolation, policy gating, DND/call-forward audited |
| Runtime management (#177) | Implemented | Go agent status push to API ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ node status endpoint returns snapshot; reloadxml smoke with result recorded |

To run PBX evidence gates:

```sh
pnpm check:pbx-evidence -- --manifest=<release-evidence.json>
```

Or as part of the full evidence bundle:

```sh
pnpm release:evidence-check -- --manifest=<release-evidence.json>
```

Evidence JSON must include `pbx_evidence` fields for each implemented feature.
See `docs/ops/templates/release-evidence-template.json` for the required fields
and stage-specific metadata (`stage`, `github_release`, and operator signoff).

These gates are required for production promotion of each PBX feature.
They are **not required** for the current public beta stage (beta gates pass without PBX evidence).

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
