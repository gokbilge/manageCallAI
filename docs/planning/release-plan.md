# Release Plan

## 1. Purpose

This document turns the remaining roadmap into concrete implementation slices
from the current foundation to a release-ready product.

It is designed to answer:

- what is left
- what must happen sequentially
- what can happen in parallel
- what each slice unlocks

## 2. Current Baseline

Already implemented and proven:

- tenant registration and login
- extension CRUD
- encrypted SIP credential storage
- FreeSWITCH directory XML lookup
- runtime event ingestion
- phone number / inbound route / dialplan projection foundations
- IVR flow CRUD
- structural validation
- deterministic simulation
- approval-aware publish / rollback attempts
- React tenant workspace foundation
- platform read surfaces
- stock FreeSWITCH runtime proof with live SIP registration

Reference:

- [slices/SLICE-00-current-baseline.md](slices/SLICE-00-current-baseline.md)

## 2.1 Current Slice Status

Last audited: 2026-05-30.

| Slice | Status |
|-------|--------|
| `SLICE-00` | completed |
| `SLICE-01` | completed |
| `SLICE-02` | completed |
| `SLICE-03` | completed |
| `SLICE-04` | completed |
| `SLICE-05` | completed |
| `SLICE-06` | completed |
| `SLICE-07` | completed |
| `SLICE-08` | completed |
| `SLICE-09` | completed |
| `SLICE-10` | completed |
| `SLICE-11` | completed |
| `SLICE-12` | completed |
| `SLICE-13` | completed as umbrella decomposition |
| `SLICE-14` | completed |
| `SLICE-15` | completed |
| `SLICE-16` | completed |
| `SLICE-17` | completed |
| `SLICE-18` | completed |
| `SLICE-19` | completed |
| `SLICE-20` | completed |
| `SLICE-21` | completed |
| `SLICE-22` | completed |
| `SLICE-23` | completed |
| `SLICE-24` | completed |
| `SLICE-25` | completed |
| `SLICE-26` | completed |
| `SLICE-27` | completed |
| `SLICE-28` | completed |
| `SLICE-29` | completed |
| `SLICE-30` | completed |
| `SLICE-31` | completed |
| `SLICE-32` | completed |
| `SLICE-33` | completed |
| `SLICE-35` | partially implemented - documented foundation |
| `SLICE-36` | planned |
| `SLICE-37` | partially implemented - tenant cockpit foundation |
| `SLICE-38` | completed |
| `SLICE-39` | completed |
| `SLICE-40` | completed |
| `SLICE-41` | completed |
| `SLICE-42` | planned |
| `SLICE-43` | completed |
| `SLICE-44` | completed outside SLICE-42 tracing dependency |
| `SLICE-49` | planned |
| `SLICE-50` | planned |
| `SLICE-51` | planned |
| `SLICE-52` | completed |
| `SLICE-53` | completed |
| `SLICE-54` | completed |

The original v1 release-plan slices are closed. The next release-candidate feature
set is now explicit as `SLICE-25` through `SLICE-32`. Contract generation,
MCP alignment, telecom CI gates, and P1/P2 hardening are tracked in `SLICE-33`
and `SLICE-35` through `SLICE-44`. `SLICE-34` is referenced by `SLICE-33` as a
future Fastify/Zod cleanup, but no slice document exists yet.

That means:

- release-critical slices have been implemented and documented
- the slice map below preserves the historical v1 execution context
- the next planning lane is no longer vague post-release intent
- future work should continue through the explicit `SLICE-25` to `SLICE-32` set

## 3. Release Thesis

The first release should prove:

1. a tenant can model inbound call behavior as desired state
2. the system can validate and simulate that behavior before production
3. published state is executed by stock FreeSWITCH through constrained adapters
4. humans, n8n, and MCP all operate on the same safe lifecycle

## 4. Slice Map

```text
SLICE-00 Current Baseline
  |
  +--> SLICE-01 Admin Surface Completion --------+
  |                                              |
  +--> SLICE-02 Approval Operations ------------+----> SLICE-08 Visual Builder
  |                                              |            |
  +--> SLICE-03 Prompt Assets -------------------+            |
  |                                              |            +--> SLICE-09 n8n Surfaces
  +--> SLICE-04 IVR Runtime Resolver ------------+------------+--> SLICE-10 MCP Surfaces
  |       |                                      |
  |       +--> SLICE-05 FreeSWITCH Runtime Loop -+
  |       |
  |       +--> SLICE-06 Call Groups -------------+
  |                 |
  |                 +--> SLICE-07 Inbound IVR and Call Group Projection
  |                                   |
  |                                   +--> SLICE-11 Release Hardening
  |
  +--> SLICE-12 Outbound Event Delivery ----------> SLICE-09
  |                                                 SLICE-10
  |
  +--> SLICE-14 Operator Surface Gaps ----+-------> SLICE-11 Release Hardening
       (nav, prompts UI, session view)
  |
  +--> SLICE-13 Post-Release Expansion (umbrella)
            |
            +--> SLICE-15 Advanced IVR Node Types
            +--> SLICE-16 Queue and Voicemail Models
            +--> SLICE-17 Schedule-Aware Routing
            +--> SLICE-18 Outbound Routing and Trunk Policy
            +--> SLICE-19 Observability and Operations Depth
            +--> SLICE-20 Automation and AI Depth
            +--> SLICE-21 Enterprise and Multi-Tenant Hardening
            +--> SLICE-22 Recorded Media and Export Operations
            +--> SLICE-23 Caller Routing and Outbound Runtime
            +--> SLICE-24 Tenant User Management

  +--> SLICE-25 Webhook Delivery Queue -----------+
  |                                               |
  +--> SLICE-26 Live Runtime Smoke Automation ----+----> Release Candidate Feature Pack A
  |                                               |
  +--> SLICE-27 Session Replay UI and API --------+
  |
  +--> SLICE-28 Voicemail Media Capture ----------+
  |                                               |
  +--> SLICE-29 Outbound Call Execution ----------+----> Release Candidate Feature Pack B
  |                                               |
  +--> SLICE-30 Automation Operator Tools --------+
  |
  +--> SLICE-31 Prompt and IVR AI Contracts ------+
  |
  +--> SLICE-32 Omnichannel Channel Adapters -----+

  +--> SLICE-33 Schema Contracts Package ----------+
  |
  +--> SLICE-35 BPMN-Inspired IVR Graph Model -----+
  |                                               |
  +--> SLICE-36 Visual IVR Execution Engine -------+
  |                                               |
  +--> SLICE-37 Live Observability Cockpit --------+
  |
  +--> SLICE-38 MCP Contract Alignment ------------+
  |
  +--> SLICE-39 CI Telecom Safety Gates -----------+
  |
  +--> SLICE-40 P1 Runtime/Ops Foundation ---------+
  |
  +--> SLICE-41 P1 Leftovers ----------------------+
  |
  +--> SLICE-42 AI Dry-Run/Audit/Tracing ----------+
  |
  +--> SLICE-43 MVP Demonstrable Reliability ------+
  |
  +--> SLICE-44 Production Readiness Hardening ----+
```

## 5. Parallel Work Tracks

### Track A - Operator Product Surfaces

- `SLICE-01`
- `SLICE-02`
- `SLICE-08`
- `SLICE-14`

### Track B - IVR Runtime Core

- `SLICE-03`
- `SLICE-04`
- `SLICE-05`
- `SLICE-06`
- `SLICE-07`

### Track C - Automation Surfaces

- `SLICE-12`
- `SLICE-09`
- `SLICE-10`

### Track D - Release Readiness

- `SLICE-11`

### Track E - Post-Release Expansion

- `SLICE-13`
- `SLICE-15`
- `SLICE-16`
- `SLICE-17`
- `SLICE-18`
- `SLICE-19`
- `SLICE-20`
- `SLICE-21`
- `SLICE-22`
- `SLICE-23`
- `SLICE-24`

### Track F - Release Candidate Feature Increase

- `SLICE-25`
- `SLICE-26`
- `SLICE-27`
- `SLICE-28`
- `SLICE-29`
- `SLICE-30`
- `SLICE-31`
- `SLICE-32`

### Track G - Contracts, Reliability, And Hardening

- `SLICE-33`
- `SLICE-35`
- `SLICE-36`
- `SLICE-37`
- `SLICE-38`
- `SLICE-39`
- `SLICE-40`
- `SLICE-41`
- `SLICE-42`
- `SLICE-43`
- `SLICE-44`

### Track H - Public Alpha To Production

- `SLICE-49`
- `SLICE-50`
- `SLICE-51`
- `SLICE-52`
- `SLICE-53`
- `SLICE-54`

## 6. Recommended Execution Order

### Stage 1 - Close product gaps around the current IVR foundation

1. `SLICE-01` Admin Surface Completion
2. `SLICE-02` Approval Operations
3. `SLICE-03` Prompt Assets

### Stage 2 - Make IVR executable, not just modelled

4. `SLICE-04` IVR Runtime Resolver
5. `SLICE-05` FreeSWITCH Runtime Loop

### Stage 3 - Expand routing power

6. `SLICE-06` Call Groups
7. `SLICE-07` Inbound IVR and Call Group Projection

### Stage 4 - Improve authoring and automation

8. `SLICE-08` Visual Builder
9. `SLICE-09` n8n Surfaces
10. `SLICE-10` MCP Surfaces
11. `SLICE-14` Operator Surface Gaps (nav, prompts UI, session observability)

### Stage 5 - Release

12. `SLICE-11` Release Hardening

### Stage 6 - Post Release Expansion

13. `SLICE-13` Post-Release Expansion (umbrella decomposition)
14. `SLICE-15` Advanced IVR Node Types
15. `SLICE-16` Queue and Voicemail Models
16. `SLICE-17` Schedule-Aware Routing
17. `SLICE-18` Outbound Routing and Trunk Policy
18. `SLICE-19` Observability and Operations Depth
19. `SLICE-20` Automation and AI Depth
20. `SLICE-21` Enterprise and Multi-Tenant Hardening
21. `SLICE-22` Recorded Media and Export Operations
22. `SLICE-23` Caller Routing and Outbound Runtime Integration
23. `SLICE-24` Tenant User Management

### Stage 7 - Release Candidate Feature Increase

24. `SLICE-25` Webhook Delivery Queue
25. `SLICE-26` Live Runtime Smoke Automation
26. `SLICE-27` Session Replay UI and API
27. `SLICE-28` Voicemail Media Capture and Playback
28. `SLICE-29` Outbound Call Execution Hardening
29. `SLICE-30` Automation Operator Tools
30. `SLICE-31` Prompt and IVR AI Integration Contracts
31. `SLICE-32` Omnichannel Messaging and Meeting Adapters

### Stage 8 - Reliability And Production Readiness

32. `SLICE-33` Schema Contracts Package
33. `SLICE-35` BPMN-Inspired IVR Graph Model
34. `SLICE-36` Visual IVR Execution Engine
35. `SLICE-37` Live Observability Cockpit
36. `SLICE-38` MCP Contract Alignment
37. `SLICE-39` CI Telecom Safety Gates
38. `SLICE-40` P1 Runtime And Operations Hardening
39. `SLICE-41` P1 Leftover Telecom, Ops, And AI Hardening
40. `SLICE-42` AI Dry-Run, Audit Identity, And Tracing
41. `SLICE-43` MVP Demonstrable Reliability
42. `SLICE-44` Production Readiness Hardening

### Stage 9 - Public Alpha To Production

43. `SLICE-49` Public Alpha Readiness And Security Triage
44. `SLICE-50` Self-Hosted FreeSWITCH Smoke CI
45. `SLICE-51` Release-Grade Product Surfaces, Coverage, And Runbooks
46. `SLICE-52` Production Runtime E2E Gate
47. `SLICE-53` Production Deployment And Network Hardening
48. `SLICE-54` Backup, Restore, Upgrade, And DR

## 7. Minimal Release Gate

The product is ready for the first release only when all of these are true:

- inbound DID can route to published IVR
- IVR runtime loop is proven on stock FreeSWITCH
- publish approval path is complete end to end
- visual editing is usable enough for human operators
- n8n and MCP can safely create drafts, validate, simulate, and request publish
- release smoke tests and docs are stable

## 8. Slice Index

- [SLICE-00](slices/SLICE-00-current-baseline.md)
- [SLICE-01](slices/SLICE-01-admin-surface-completion.md)
- [SLICE-02](slices/SLICE-02-approval-operations.md)
- [SLICE-03](slices/SLICE-03-prompt-assets.md)
- [SLICE-04](slices/SLICE-04-ivr-runtime-resolver.md)
- [SLICE-05](slices/SLICE-05-freeswitch-runtime-loop.md)
- [SLICE-06](slices/SLICE-06-call-groups.md)
- [SLICE-07](slices/SLICE-07-inbound-ivr-and-call-group-projection.md)
- [SLICE-08](slices/SLICE-08-visual-builder.md)
- [SLICE-09](slices/SLICE-09-n8n-surfaces.md)
- [SLICE-10](slices/SLICE-10-mcp-surfaces.md)
- [SLICE-11](slices/SLICE-11-release-hardening.md)
- [SLICE-12](slices/SLICE-12-outbound-event-delivery.md)
- [SLICE-13](slices/SLICE-13-post-release-expansion.md)
- [SLICE-14](slices/SLICE-14-operator-surface-gaps.md)
- [SLICE-15](slices/SLICE-15-advanced-ivr-node-types.md)
- [SLICE-16](slices/SLICE-16-queue-and-voicemail-models.md)
- [SLICE-17](slices/SLICE-17-schedule-aware-routing.md)
- [SLICE-18](slices/SLICE-18-outbound-routing-and-trunk-policy.md)
- [SLICE-19](slices/SLICE-19-observability-and-operations-depth.md)
- [SLICE-20](slices/SLICE-20-automation-and-ai-depth.md)
- [SLICE-21](slices/SLICE-21-enterprise-and-multi-tenant-hardening.md)
- [SLICE-22](slices/SLICE-22-recorded-media-and-export-operations.md)
- [SLICE-23](slices/SLICE-23-caller-routing-and-outbound-runtime.md)
- [SLICE-24](slices/SLICE-24-tenant-user-management.md)
- [SLICE-25](slices/SLICE-25-webhook-delivery-queue.md)
- [SLICE-26](slices/SLICE-26-live-runtime-smoke-automation.md)
- [SLICE-27](slices/SLICE-27-session-replay-ui-and-api.md)
- [SLICE-28](slices/SLICE-28-voicemail-media-capture-and-playback.md)
- [SLICE-29](slices/SLICE-29-outbound-call-execution-hardening.md)
- [SLICE-30](slices/SLICE-30-automation-operator-tools.md)
- [SLICE-31](slices/SLICE-31-prompt-and-ivr-ai-integration-contracts.md)
- [SLICE-32](slices/SLICE-32-omnichannel-messaging-and-meeting-adapters.md)
- [SLICE-33](slices/SLICE-33-schema-contracts-package.md)
- [SLICE-35](slices/SLICE-35-bpmn-inspired-ivr-graph-model.md)
- [SLICE-36](slices/SLICE-36-visual-ivr-execution-engine.md)
- [SLICE-37](slices/SLICE-37-live-observability-cockpit.md)
- [SLICE-38](slices/SLICE-38-mcp-contract-alignment.md)
- [SLICE-39](slices/SLICE-39-ci-telecom-safety-gates.md)
- [SLICE-40](slices/SLICE-40-p1-runtime-and-operations-hardening.md)
- [SLICE-41](slices/SLICE-41-p1-leftover-telecom-ops-and-ai-hardening.md)
- [SLICE-42](slices/SLICE-42-ai-dry-run-audit-identity-and-tracing.md)
- [SLICE-43](slices/SLICE-43-mvp-demonstrable-reliability.md)
- [SLICE-44](slices/SLICE-44-production-readiness-hardening.md)
- [SLICE-49](slices/SLICE-49-public-alpha-readiness.md)
- [SLICE-50](slices/SLICE-50-self-hosted-freeswitch-smoke-ci.md)
- [SLICE-51](slices/SLICE-51-release-grade-product-coverage-and-runbooks.md)
- [SLICE-52](slices/SLICE-52-production-runtime-e2e-gate.md)
- [SLICE-53](slices/SLICE-53-production-deployment-and-network-hardening.md)
- [SLICE-54](slices/SLICE-54-backup-restore-upgrade-and-dr.md)
