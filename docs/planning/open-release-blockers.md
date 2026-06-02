# Open Release Blockers

Last updated: 2026-06-02.

Authoritative issue state lives in GitHub. This file records release gates and
evidence requirements so closed issues are not mistaken for production evidence.

Scripts, templates, docs, check-config mode, and issue closure are **not** evidence.
Evidence must be a real artifact (workflow run URL, uploaded JSON, CI run) tied
to the release-candidate commit.

## Current Release Stage

```
Decision:         Public beta candidate
Tag:              v0.2.0-beta.1 (cut 2026-06-02 from main at b51cdd5)
Evidence status:  Beta evidence manifest passes pnpm release:evidence-check
                  Smoke run 26825030902 passed all gates on self-hosted runner
Next step:        n8n / MCP / SDK end-to-end evidence before beta-ready promotion
                  Full production evidence bundle before RC promotion
```

## What closed since the last update (2026-06-02)

| Issue | Gate | Resolution |
|---|---|---|
| [#130](https://github.com/gokbilge/manageCallAI/issues/130) | Clean-clone alpha verification | Evidenced for v0.2.0-alpha |
| [#131](https://github.com/gokbilge/manageCallAI/issues/131) | Observability HUD | Implemented — candidate run evidence still required for beta-ready |
| [#132](https://github.com/gokbilge/manageCallAI/issues/132) | Webhook signing/replay/idempotency | Implemented and CI-tested |
| [#133](https://github.com/gokbilge/manageCallAI/issues/133) | n8n workflows | Documented — end-to-end run proof still required |
| [#134](https://github.com/gokbilge/manageCallAI/issues/134) | MCP setup and capability matrix | Documented and drift-tested — run proof still required |
| [#135](https://github.com/gokbilge/manageCallAI/issues/135) | SDK publish/dry-run | Workflow exists — latest run failed; re-run required |
| [#136](https://github.com/gokbilge/manageCallAI/issues/136) | Retention and legal hold API | API and worker implemented — storage cleanup gap remains |
| [#137](https://github.com/gokbilge/manageCallAI/issues/137) | Self-hosted FreeSWITCH smoke | Smoke run 26825030902 passed all gates |
| [#138](https://github.com/gokbilge/manageCallAI/issues/138) | Carrier interop | Lab evidence (FusionPBX/NetGSM) in manifest — live carrier scenarios pending |
| [#139](https://github.com/gokbilge/manageCallAI/issues/139) | Rate-limit production values | Documented; multi-instance topology not yet validated |
| [#140](https://github.com/gokbilge/manageCallAI/issues/140) | Upgrade/migration rehearsal | Template documented — rehearsal not yet executed |
| [#141](https://github.com/gokbilge/manageCallAI/issues/141) | Coverage thresholds | API 67.46% / Web 80% / MCP 85% — thresholds raised |
| [#150](https://github.com/gokbilge/manageCallAI/issues/150) | Candidate evidence bundle | v0.2.0-beta.1 manifest passes validator |

## Public Alpha — Closed

All alpha gates are closed for `v0.2.0-alpha`.

## Public Beta — Open Blockers

The `v0.2.0-beta.1` tag exists and the evidence manifest passes `pnpm release:evidence-check`.
These gates remain open before the project can be described as **beta-ready**:

| Gate | Issue | P | Status | Required evidence | Next action |
|---|---|---|---|---|---|
| n8n example workflows end-to-end | [#157](https://github.com/gokbilge/manageCallAI/issues/157) | P0 | **CLOSED** — 9/9 templates valid; HMAC-SHA256 signing compatible with n8n; live webhook delivery queued. Evidence: beta-smoke-26845537361 | — | Closed |
| MCP setup and capability matrix proof | [#158](https://github.com/gokbilge/manageCallAI/issues/158) | P0 | **CLOSED** — 22/22 tools listed via MCP protocol; live list_ivr_flows call succeeded. Evidence: beta-smoke-26845537361 | — | Closed |
| SDK publish/dry-run | [#159](https://github.com/gokbilge/manageCallAI/issues/159) | P0 | **CLOSED** — Build+pack dry-run passed (run 26845539137); workflow fixed to not fail on tag pushes | — | Closed |
| Operator UI evidence | — | P0 | IVR builder, approvals, rollback, HUD implemented — no run-stack screenshot/test | Screenshot or test evidence from a running stack | Run stack, capture screenshots for release notes |
| Observability HUD from running stack | — | P0 | Implemented — smoke passed but no isolated UI proof | Evidence from running stack (screenshot or test) | Covered by operator UI evidence above |

## Production Release — Open Blockers

None of the following gates are evidenced for a production release candidate.
All require real artifacts from the target deployment environment.

| Gate | Issue | P | Status | Required evidence | Next action |
|---|---|---|---|---|---|
| Production runtime E2E on `rc/**` branch | [#164](https://github.com/gokbilge/manageCallAI/issues/164) | P0 | Smoke run 26825030902 on `docs/beta-evidence-v0.2.0` branch — must be re-run on `rc/**` | `FreeSWITCH runtime smoke` check on `release/**` or `rc/**` | Create rc branch; smoke triggers automatically |
| Restore rehearsal (RC environment) | [#160](https://github.com/gokbilge/manageCallAI/issues/160) | P1 | Template documented; historical evidence from PR #116 | `pnpm restore:rehearsal` JSON for RC environment | Execute rehearsal |
| Upgrade and migration rehearsal | [#160](https://github.com/gokbilge/manageCallAI/issues/160) | P1 | Template at `docs/ops/upgrade-rehearsal-evidence.md`; not yet executed | Upgrade + rollback rehearsal record | Execute rehearsal |
| SIP TLS/SRTP/NAT evidence (RC topology) | [#163](https://github.com/gokbilge/manageCallAI/issues/163) | P1 | Historical artifact from smoke run 26803056139; RC-topology artifact required | Validated SIP TLS/SRTP/NAT JSON from RC environment | Rerun on RC topology |
| Runtime token and secret rotation evidence | [#163](https://github.com/gokbilge/manageCallAI/issues/163) | P1 | Check passes; no rehearsal artifact for RC | Rotation rehearsal JSON + log redaction linkage | `pnpm check:runtime-token-rotation -- --evidence=<file>` |
| Log redaction artifact (candidate) | [#163](https://github.com/gokbilge/manageCallAI/issues/163) | P1 | CI passes (20/20); no candidate-level artifact file | Sanitized log artifact from candidate deployment | Generate and attach artifact |
| Production soak / load evidence (RC topology) | [#162](https://github.com/gokbilge/manageCallAI/issues/162) | P1 | Lab evidence from PR #116 (1800s, 0% failure, p95 8.78ms); RC topology evidence required | `pnpm production:soak` output from target environment | Run soak on target env |
| Runtime SLO evidence (RC topology) | [#162](https://github.com/gokbilge/manageCallAI/issues/162) | P1 | Lab evidence: directory p95 12.8ms, dialplan p95 17.19ms; RC evidence required | `pnpm production:slo-check` against target env | Run SLO check |
| Carrier interop certification — live carrier | [#162](https://github.com/gokbilge/manageCallAI/issues/162) | P1 | Lab: sip_register, TLS, NAT passed; inbound/outbound/DTMF/hangup require live carrier | Re-test all 8 scenarios with real carrier trunk | Schedule live carrier test |
| Backup retention policy (target env) | [#160](https://github.com/gokbilge/manageCallAI/issues/160) | P1 | Template documented; no target-env validation | `pnpm check:backup-retention-policy` against target | Run validator with target policy |
| Retention storage / object cleanup | [#161](https://github.com/gokbilge/manageCallAI/issues/161) | P1 | DB + API + worker exist; object-storage file deletion and export-before-delete NOT implemented | Implementation + evidence | See issue #161 |
| DSR / right-to-erasure behavior | [#161](https://github.com/gokbilge/manageCallAI/issues/161) | P1 | Not documented | Documentation + implementation decision | See issue #161 |
| Firewall / network hardening (target env) | [#163](https://github.com/gokbilge/manageCallAI/issues/163) | P1 | Docs + check pass in dev (4 warnings); target-env evidence required | `pnpm check:network-config` against production config | Validate target deployment |
| Outbound toll-fraud controls (carrier level) | [#162](https://github.com/gokbilge/manageCallAI/issues/162) | P1 | Policy API + integration tests implemented; no carrier-level block/allow proof | Fraud allow/block proof with audit + alert evidence | Run live policy proof |
| Multi-instance rate limiting | [#163](https://github.com/gokbilge/manageCallAI/issues/163) | P1 | Redis store implemented; 4 warnings in check — no topology proof | Production topology validation | `pnpm production:rate-limit-check` with production config |
| Release evidence bundle + operator signoff | [#164](https://github.com/gokbilge/manageCallAI/issues/164) | P0 | v0.2.0-beta.1 manifest passes validator with beta fields; production fields still TBD | Completed manifest for RC commit + operator signoff | Assemble once all P1s close |

## Issue Body Template

```markdown
## Why

## Current State

## Scope

## Acceptance Criteria

## Evidence Required

## Suggested Files

## Blocked By

## Release Impact
```

Recommended labels: `release-blocker`, `beta`, `production`, `security`,
`runtime`, `freeswitch`, `sip`, `srtp`, `nat`, `ci`, `evidence`, `docs`,
`testing`, `backup-restore`, `observability`, `frontend`, `rate-limit`,
`fraud`, `retention`, `sdk`, `mcp`, `n8n`, `ops`.

Priority guidance:
- P0: blocks public beta or a release gate
- P1: required before production
- P2: hardening or improvement
- P3: docs or cleanup
