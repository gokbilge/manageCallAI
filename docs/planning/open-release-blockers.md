# Open Release Blockers

Last updated: 2026-06-02.

Authoritative issue state lives in GitHub. This file records release gates and
evidence requirements so closed issues are not mistaken for production evidence.

## Current Release Stage

# Release Stage Decision

Decision: Public beta candidate

Reason: Public alpha evidence exists and current `main` includes beta-readiness
implementation work, but beta promotion still needs evidence tied to the intended
candidate. Production promotion requires a complete release-candidate evidence
bundle and operator signoff.

Highest-risk blocker: release-candidate runtime and production evidence are not
assembled into a current passing manifest.

Next required step: cut or identify the beta/RC candidate commit, run the
candidate-bound evidence gates, and update `docs/release/release-evidence-v0.2.0.json`.

Tracking issue: [#150](https://github.com/gokbilge/manageCallAI/issues/150)

## Public Alpha

| Gate | Issue | Status | Owner | Required evidence | Next action |
|---|---|---|---|---|---|
| Clean-clone public alpha verification and release notes evidence | [#130](https://github.com/gokbilge/manageCallAI/issues/130) | evidenced for `v0.2.0-alpha` | maintainer | clean-clone demo proof, CI run, release notes | no blocker |

## Public Beta

| Gate | Issue | Status | Owner | Required evidence | Next action |
|---|---|---|---|---|---|
| Self-hosted FreeSWITCH runtime smoke | [#137](https://github.com/gokbilge/manageCallAI/issues/137) | scripted/evidenced on feature branch; candidate evidence required | maintainer | passing `FreeSWITCH runtime smoke` run for beta/RC commit | run smoke on candidate branch or tag |
| Observability HUD beta surface | [#131](https://github.com/gokbilge/manageCallAI/issues/131) | done; candidate UI evidence required | frontend | screenshot/video or test evidence from running stack | attach evidence to beta notes |
| Webhook signing, replay, idempotency | [#132](https://github.com/gokbilge/manageCallAI/issues/132) | done; candidate evidence required | backend | test run and docs verification | cite CI run and docs |
| n8n example workflows | [#133](https://github.com/gokbilge/manageCallAI/issues/133) | documented; end-to-end evidence required | integrations | workflow import/run proof against candidate API | run examples and attach proof |
| MCP setup and capability matrix | [#134](https://github.com/gokbilge/manageCallAI/issues/134) | documented/tested; setup evidence required | integrations | MCP tool list/call proof and capability matrix check | attach candidate proof |
| SDK versioning and publishing readiness | [#135](https://github.com/gokbilge/manageCallAI/issues/135) | scripted; publish workflow latest run failed | maintainer | `npm pack`/publish dry-run or package publish success | rerun SDK dry-run/publish workflow |
| Coverage threshold or beta exceptions | [#141](https://github.com/gokbilge/manageCallAI/issues/141) | documented; candidate evidence required | maintainers | coverage run for candidate and accepted exceptions | attach coverage report |
| Candidate evidence bundle | [#150](https://github.com/gokbilge/manageCallAI/issues/150) | open | release manager | candidate-bound evidence manifest | assemble and validate manifest |

## Production Release

| Gate | Issue | Status | Owner | Required evidence | Next action |
|---|---|---|---|---|---|
| Production runtime E2E and RC smoke | [#137](https://github.com/gokbilge/manageCallAI/issues/137) | scripted; no current RC manifest entry | maintainer | RC-bound smoke run URL and uploaded runtime artifacts | run on `rc/**` or `release/**` |
| Restore rehearsal | historical [#98](https://github.com/gokbilge/manageCallAI/issues/98) | evidenced historically; current RC evidence required | ops | restore rehearsal JSON for RC environment | rerun or attach current evidence |
| Upgrade and migration rehearsal | [#140](https://github.com/gokbilge/manageCallAI/issues/140) | documented; current evidence required | ops | upgrade + rollback rehearsal record | execute rehearsal |
| SIP TLS/SRTP/NAT evidence | historical [#92](https://github.com/gokbilge/manageCallAI/issues/92) | evidenced historically; current RC evidence required | runtime | validated SIP TLS/SRTP/NAT JSON | rerun for RC topology |
| Runtime token and secret rotation | historical [#94](https://github.com/gokbilge/manageCallAI/issues/94) | scripted/evidenced historically; current evidence required | security | rotation rehearsal JSON and log redaction linkage | rerun for RC |
| Log redaction evidence | historical hardening work | scripted; current evidence required | security | redaction evidence JSON from candidate logs | generate artifact |
| Production soak/load | historical [#100](https://github.com/gokbilge/manageCallAI/issues/100) | lab evidence exists; current RC evidence required | ops | soak evidence from target topology | run soak |
| Runtime SLO | historical [#100](https://github.com/gokbilge/manageCallAI/issues/100) | lab evidence exists; current RC evidence required | ops | runtime lookup latency evidence | run SLO check |
| Carrier interop certification | [#138](https://github.com/gokbilge/manageCallAI/issues/138) | live FusionPBX/NetGSM evidence exists; RC manifest still placeholder | runtime | carrier evidence referenced from RC manifest | validate and link in manifest |
| Backup retention policy | historical [#99](https://github.com/gokbilge/manageCallAI/issues/99) | documented; target-env evidence required | ops | target backup-retention policy validation | rerun validator |
| Retention and legal hold | [#136](https://github.com/gokbilge/manageCallAI/issues/136) | implemented; storage/export evidence missing | backend/ops | API tests plus object-storage cleanup/export-before-delete decision | close storage/export gaps or accept risk |
| Firewall/network hardening | historical [#93](https://github.com/gokbilge/manageCallAI/issues/93) | documented/scripted; target evidence required | ops | network config and FreeSWITCH hardening evidence | validate target deployment |
| Outbound toll-fraud controls | fraud slice | implemented; carrier-level evidence required | backend/runtime | fraud allow/block proof with audit/security alert evidence | run live policy proof |
| Release evidence bundle and operator signoff | [#103](https://github.com/gokbilge/manageCallAI/issues/103) | v0.1 manifest exists; v0.2 manifest is incomplete | release manager | passing `release:evidence-check` manifest with operator signoff | complete manifest |
| Current candidate evidence tracking | [#150](https://github.com/gokbilge/manageCallAI/issues/150) | open | release manager | v0.2 manifest tied to candidate commit | run gates and update manifest |

## Issue Body Template

Use this shape when a closed historical issue needs a fresh release-candidate
tracking issue:

```markdown
## Why

## Current state

## Scope

## Acceptance criteria

## Evidence required

## Suggested files

## Blocked by

## Release impact
```

Recommended labels: `release-blocker`, `beta`, `production`, `security`,
`runtime`, `freeswitch`, `sip`, `srtp`, `nat`, `ci`, `evidence`, `docs`,
`testing`, `backup-restore`, `observability`, `frontend`, `rate-limit`,
`fraud`, `retention`, `sdk`, `mcp`, `n8n`, `ops`.

Priority guidance:

- P0: blocks public beta or a release gate.
- P1: required before production.
- P2: hardening or improvement.
- P3: docs or cleanup.
