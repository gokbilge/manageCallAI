# Production Readiness Roadmap

This roadmap converts the current release-readiness assessment into execution
lanes. It is intentionally stricter than the public-alpha gate.

## Current Recommendation

Last updated: 2026-06-02.

- **Internal alpha:** ✅ Ready.
- **Public alpha:** 🟡 Candidate — 2 unchecked items remain (clean-clone demo
  loop verification and runtime proof on a clean machine). All other alpha
  gates are closed.
- **Public beta:** ⛔ Not ready — observability HUD, webhook/n8n/MCP/SDK
  verification, and coverage thresholds remain open. The self-hosted smoke
  runner is provisioned and run 26803056139 passed, but the smoke must be
  tied to a `release/**` or `rc/**` branch before beta promotion.
- **Production:** ⛔ Not ready — several production gates have evidence from
  the lab (soak, SLO, restore, carrier, release bundle) but the following
  remain open: retention API and legal hold endpoints, multi-instance
  rate-limiting live evidence, upgrade/migration rehearsal, live carrier
  re-test, and the RC smoke run on a `release/**` branch.

## Stage A: Public Alpha Candidate — 🟡 In Progress

Goal: make the repository honest, runnable, and safe for public evaluation.

Required slices:

- `SLICE-49`: public alpha readiness and security triage

Exit criteria:

- high/medium CodeQL findings closed or triaged
- README labels the project alpha/not production-ready
- public alpha readiness and known limitations documented
- local alpha deployment guide verified from a clean clone
- demo/runtime proof result captured in release notes

## Stage B: Public Beta Foundation — ⛔ Not Ready

Goal: prove the runtime path continuously and make the operator surfaces usable.

Required slices:

- `SLICE-50`: self-hosted FreeSWITCH smoke CI
- `SLICE-51`: release-grade product surfaces and coverage

Exit criteria:

- self-hosted or dedicated FreeSWITCH smoke gate proves runtime loop
- visual IVR builder supports the main authoring workflow
- observability HUD supports live operations triage
- tenant isolation and runtime actor boundaries have matrix coverage
- MCP/n8n docs and examples are verified end to end
- API/Web/MCP/Go coverage meets beta thresholds

## Stage C: Production Hardening — ⛔ Not Ready (partial lab evidence)

Goal: prepare real operators to deploy, operate, recover, and secure the system.

Required slices:

- `SLICE-52`: production runtime E2E gate
- `SLICE-53`: production deployment and network hardening
- `SLICE-54`: backup, restore, upgrade, and DR
- `SLICE-55`: load and soak testing
- `SLICE-56`: multi-instance rate limiting
- `SLICE-57`: carrier interop certification
- `SLICE-58`: runtime SLO release gate
- `SLICE-59`: release evidence bundle

Exit criteria:

- FreeSWITCH E2E smoke is required for production release candidates
- backup/restore is tested
- upgrade/migration rollback playbook is tested
- SIP/TLS/SRTP/NAT guidance is validated
- outbound fraud controls are tested
- logs and support bundles are redaction-verified
- load/soak tests cover runtime event ingestion and call-event query paths
- multi-instance deployments prove shared or edge-enforced rate limiting
- carrier interop evidence proves registration, call flow, DTMF, CDR, NAT/media, and failover expectations
- runtime lookup SLO evidence passes documented breach thresholds
- release evidence bundle contains CI, security, runtime, restore, SLO, carrier, rollback, and operator signoff evidence

## Slice Ownership

| Slice | Release Gate | Main Risk Reduced |
|---|---|---|
| `SLICE-49` | Public alpha | misleading release posture, unresolved security findings |
| `SLICE-50` | Public beta | untested real FreeSWITCH runtime integration |
| `SLICE-51` | Public beta/production | operator UX, coverage, deployment/runbook gaps |
| `SLICE-52` | Production | missing release-grade runtime E2E evidence |
| `SLICE-53` | Production | unsafe deployment defaults and network exposure |
| `SLICE-54` | Production | untested restore, upgrade, and DR procedures |
| `SLICE-55` | Production | unmeasured sustained runtime/event throughput |
| `SLICE-56` | Production | per-instance rate limits that fail open at scale |
| `SLICE-57` | Production | carrier-specific SIP/media behavior not certified |
| `SLICE-58` | Production | runtime lookup latency regressions in live call path |
| `SLICE-59` | Production | scattered release evidence and unaudited promotion decisions |

## Do Not Reclassify As Production Until

- runtime E2E is automated or required as a release gate
- production deployment docs are tested
- tenant isolation tests cover every tenant-scoped domain
- MCP/n8n remain narrower than REST and are drift-checked
- outbound toll-fraud controls are enforced and tested
- backup/restore/upgrade playbooks have been executed successfully
- soak evidence exists for the target release topology
- multi-instance rate limiting is shared or externally enforced
- at least one carrier interop evidence file has passed validation
- runtime lookup SLO evidence has passed validation
- release evidence bundle has passed validation and operator signoff
