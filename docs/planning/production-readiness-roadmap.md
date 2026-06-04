# Production Readiness Roadmap

This roadmap converts the current release-readiness assessment into execution
lanes. It is intentionally stricter than the public-alpha gate.

## Current recommendation

Last updated: 2026-06-04.

- **Internal alpha:** Ready.
- **Public alpha:** Historically evidenced.
- **Public beta candidate:** The code line is beyond early beta foundations, but
  release posture must still follow evidence and candidate-bound validation.
- **Production:** Do not infer production readiness from implementation alone.
  Production requires current release-candidate evidence for runtime smoke,
  production E2E, restore/upgrade, SLO/soak/load, carrier interop,
  multi-instance rate limiting, retention/storage/export behavior, security
  gates, and operator signoff.

## Product release train

The next feature releases should follow this product roadmap:

- `v0.4.x` - P0 competitive baseline
- `v0.5.x` - P1 operational maturity
- `v0.6.x` - P2 AI-native differentiation

This product roadmap is separate from release evidence posture. A feature may be
targeted for one of these release lines without that release line being
production-ready.

## Stage A: Public alpha

Goal: make the repository honest, runnable, and safe for public evaluation.

Required slices:

- `SLICE-49`: public alpha readiness and security triage

Exit criteria:

- high/medium CodeQL findings closed or triaged
- README labels the project alpha/not production-ready
- public alpha readiness and known limitations documented
- local alpha deployment guide verified from a clean clone
- demo/runtime proof result captured in release notes

## Stage B: Public beta foundation

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

## Stage C: Production hardening

Goal: prepare real operators to deploy, operate, recover, and secure the
system.

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
- carrier interop evidence proves registration, call flow, DTMF, CDR,
  NAT/media, and failover expectations
- runtime lookup SLO evidence passes documented breach thresholds
- release evidence bundle contains CI, security, runtime, restore, SLO,
  carrier, rollback, and operator signoff evidence

## Slice ownership

| Slice | Release gate | Main risk reduced |
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

## PBX completeness and competitive productization

The PBX completeness APIs landed in the `v0.3.x` code line, but several
operator-facing product surfaces remain incomplete. The next planning frame is
therefore not "implement the backend from scratch" but "turn the implemented
backend into a competitive product surface."

### `v0.4.x` - P0 competitive baseline

Goal: become a credible hard-PBX competitor baseline for operators and admins.

Required outcomes:

- gateway/trunk apply workflow in the web UI
- feature-code admin surface
- parking-lot admin surface
- conference-room admin surface
- stronger operator cockpit and reporting baseline
- first operator-facing trunk/carrier test workflow
- emergency routing and safety guidance

### `v0.5.x` - P1 operational maturity

Goal: deepen operator trust, end-user completeness, and enterprise operations.

Required outcomes:

- end-user portal completion
- evidence bundle status surfaced in the product UI
- stronger retention/storage/export flows
- carrier health and template workflows
- broader lifecycle consistency across more object types

### `v0.6.x` - P2 AI-native differentiation

Goal: deliver buyer-visible AI features that save operator time and reduce
risk.

Required outcomes:

- AI call failure explanation
- AI route risk analysis
- AI voicemail/call summaries
- natural-language reporting

| Slice | Feature | Release gate |
|---|---|---|
| `SLICE-60` | Feature codes | Implemented in API/runtime; `v0.4.x` web productization |
| `SLICE-61` | Call parking | Implemented in API/runtime; `v0.4.x` web productization |
| `SLICE-62` | Native conferencing | Implemented in API/runtime; `v0.4.x` web productization |
| `SLICE-63` | Gateway reload on trunk change | Implemented in API/runtime; `v0.4.x` operator workflow |
| `SLICE-64` | End-user self-service portal | Implemented in API/policy layer; `v0.5.x` product completion |
| `SLICE-65` | SIP profile management API + UI | Still open; target `v0.4.x` or `v0.5.x` depending on scope |
| `SLICE-66` | Safe FreeSWITCH runtime management | Partial; broader action workflow remains open |

Do not confuse implementation presence with release evidence. These features may
exist in code while still requiring UI completion, operator workflow maturity,
and current release-bound runtime evidence.

## Do not reclassify as production until

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
