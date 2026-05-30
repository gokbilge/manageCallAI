# Audit — slice-35-bpmn-graph-model — 2026-05-30

**Commit:** 3cd06a3 (pre-change baseline); changes applied in this session  
**Scope:** `packages/contracts/src/schemas/ivr-flows.ts`, `apps/api/src/modules/ivr-flows/ivr-flow.validation.ts`,
`apps/api/src/modules/ivr-flows/ivr-flow.validation.test.ts`,
`docs/planning/slices/SLICE-35-bpmn-inspired-ivr-graph-model.md`  
**Build:** clean (`pnpm build` — contracts + API)  
**Lint:** clean (`pnpm lint` — contracts + API)  
**Tests:** 58 IVR validation unit tests pass  
**Result:** PASS

---

## Summary

SLICE-35 was previously documented (BPMN subset defined in IVR docs and architecture docs) but the
implementation of the explicit graph model marker and BPMN construct enforcement was missing.
This session completes that remaining implementation work. All SLICE-35 exit criteria are now met.

---

## Changes made

### Contracts (`packages/contracts/src/schemas/ivr-flows.ts`)

- Added `GRAPH_MODEL_VERSION = 'ivr-bpmn-v1'` constant.
- Added `IVR_NODE_CATEGORIES` tuple and `IvrNodeCategory` type (`start | task | gateway | end`).
- Added `IVR_NODE_CATEGORY_MAP` mapping every `IvrNodeType` to its execution category.
- Added `BPMN_ONLY_NODE_TYPES` list of 15 raw BPMN 2.0 node type names that must never appear in
  ivr-bpmn-v1 graphs (e.g. `parallelGateway`, `humanTask`, `subProcess`, `timerStartEvent`).

### Validation (`apps/api/src/modules/ivr-flows/ivr-flow.validation.ts`)

- Imports `GRAPH_MODEL_VERSION`, `IVR_NODE_CATEGORY_MAP`, `BPMN_ONLY_NODE_TYPES` from contracts.
- `defaultIvrGraph()` now includes `graph_model: "ivr-bpmn-v1"`.
- `validateIvrGraph` checks `graph_model`:
  - Absent → no error (backward-compatible with pre-SLICE-35 flows).
  - Present but wrong value → validation error with expected value in message.
- `validateIvrGraph` checks for BPMN-only graph-level fields (`bpmn_xml`, `lanes`, `pools`,
  `collaboration`, `xml`) and emits a specific error for each one found.
- Unsupported node type check now distinguishes known BPMN-only types (specific "Unsupported BPMN
  construct" message) from arbitrary unknown types (generic "Unsupported node type" message).
- Exported new `getNodeCategory(nodeType: string): IvrNodeCategory | undefined` helper.

### Tests (`apps/api/src/modules/ivr-flows/ivr-flow.validation.test.ts`)

New test blocks added:

- **BPMN-inspired graph model marker** (5 tests): defaultIvrGraph has marker, valid marker passes,
  absent marker passes (backward compat), wrong string fails, empty string fails.
- **BPMN-inspired node category mapping** (4 tests): every node type has a map entry, correct category
  for all 11 types, unknown type returns undefined, only canonical categories used.
- **Unsupported BPMN construct rejection** (5 + 15 = 20 tests): bpmn_xml field rejected, lanes rejected,
  pools rejected, every BPMN_ONLY_NODE_TYPES entry rejected with specific message, parallelGateway
  spot-check verifying message content.

---

## Findings

No open findings. All exit criteria satisfied.

| Exit criterion | Status |
|----------------|--------|
| Docs define the supported BPMN-inspired subset and rejected features | done (prior session) |
| Every implemented node type maps to start/task/gateway/end | done |
| Graph edges have explicit branch semantics | done (prior SLICE-08/15/17/23 work) |
| Validation identifies unsupported constructs clearly | done |
| `graph_json` remains the canonical API field | confirmed |

---

## What is in good shape

- Zod contracts and TypeScript types remain aligned (`IvrNodeType`, `IVR_NODE_TYPES`, `IVR_NODE_CATEGORY_MAP`).
- MCP schema drift test (`scripts/check-mcp-schemas.mjs`) not affected — no MCP schema changes.
- API key capabilities list not affected.
- Webhook payload schemas not affected.
- All 58 unit tests pass with no DB dependency.
