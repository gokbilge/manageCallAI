# Production Readiness Roadmap

This roadmap converts the current release-readiness assessment into execution
lanes. It is intentionally stricter than the public-alpha gate.

## Current Recommendation

- Internal alpha: ready.
- Public alpha: almost ready after CodeQL/security triage and alpha docs.
- Public beta: not ready.
- Production: not ready.

## Stage A: Public Alpha Candidate

Goal: make the repository honest, runnable, and safe for public evaluation.

Required slices:

- `SLICE-49`: public alpha readiness and security triage

Exit criteria:

- high/medium CodeQL findings closed or triaged
- README labels the project alpha/not production-ready
- public alpha readiness and known limitations documented
- local alpha deployment guide verified from a clean clone
- demo/runtime proof result captured in release notes

## Stage B: Public Beta Foundation

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

## Stage C: Production Hardening

Goal: prepare real operators to deploy, operate, recover, and secure the system.

Required slices:

- `SLICE-52`: production runtime E2E gate
- `SLICE-53`: production deployment and network hardening
- `SLICE-54`: backup, restore, upgrade, and DR
- add future slices for load/soak, multi-instance rate limiting, and carrier interop

Exit criteria:

- FreeSWITCH E2E smoke is required for production release candidates
- backup/restore is tested
- upgrade/migration rollback playbook is tested
- SIP/TLS/SRTP/NAT guidance is validated
- outbound fraud controls are tested
- logs and support bundles are redaction-verified
- load/soak tests cover runtime event ingestion and call-event query paths

## Slice Ownership

| Slice | Release Gate | Main Risk Reduced |
|---|---|---|
| `SLICE-49` | Public alpha | misleading release posture, unresolved security findings |
| `SLICE-50` | Public beta | untested real FreeSWITCH runtime integration |
| `SLICE-51` | Public beta/production | operator UX, coverage, deployment/runbook gaps |
| `SLICE-52` | Production | missing release-grade runtime E2E evidence |
| `SLICE-53` | Production | unsafe deployment defaults and network exposure |
| `SLICE-54` | Production | untested restore, upgrade, and DR procedures |

## Do Not Reclassify As Production Until

- runtime E2E is automated or required as a release gate
- production deployment docs are tested
- tenant isolation tests cover every tenant-scoped domain
- MCP/n8n remain narrower than REST and are drift-checked
- outbound toll-fraud controls are enforced and tested
- backup/restore/upgrade playbooks have been executed successfully
