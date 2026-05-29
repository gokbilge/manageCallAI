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

The original v1 release-plan slices are closed. The new post-release slices are now
explicit and ready for future sequencing.

That means:

- release-critical slices have been implemented and documented
- the slice map below preserves the historical v1 execution context
- the next planning lane is no longer vague post-release intent
- future work should continue through the explicit `SLICE-15` to `SLICE-21` set

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
