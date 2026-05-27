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
                                                    SLICE-10
  |
  +--> SLICE-13 Post-Release Expansion ------------> after first release
```

## 5. Parallel Work Tracks

### Track A - Operator Product Surfaces

- `SLICE-01`
- `SLICE-02`
- `SLICE-08`

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

### Stage 5 - Release

11. `SLICE-11` Release Hardening

### Stage 6 - Post Release

12. `SLICE-13` Post-Release Expansion

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
