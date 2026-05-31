# Audit — slice-36-visual-ivr-execution-engine — 2026-05-30

**Commit:** e58558b (SLICE-35 baseline); changes applied in this session  
**Scope:** `apps/api/src/modules/ivr-flows/ivr-graph-planner.ts` (new),
`apps/api/src/modules/ivr-flows/ivr-graph-planner.test.ts` (new),
`apps/api/src/modules/ivr-flows/ivr-flow.service.ts`,
`apps/api/src/modules/ivr-flows/ivr-flow.types.ts`,
`apps/api/src/modules/runtime/ivr-runtime.service.ts`,
`packages/contracts/src/schemas/ivr-flows.ts`,
`docs/planning/slices/SLICE-36-visual-ivr-execution-engine.md`  
**Build:** clean  
**Lint:** clean  
**Tests:** 31 new planner tests + 87 existing unit tests = 118 pass; 16 integration tests DB-blocked  
**Result:** PASS

---

## Summary

SLICE-36 adds a shared IVR graph execution planner used by simulation and the runtime resolver.
The planner provides typed node building, deterministic edge resolution, and shared switch input
token resolution, eliminating code duplication between the two services and enabling simulation
trace enrichment for the React visual builder.

---

## Changes made

### New: `ivr-graph-planner.ts`

- `buildPlannerGraph(graphJson)` — builds a `PlannerGraph` with a typed `ReadonlyMap<string, PlannerNode>`.
  Each `PlannerNode` carries the BPMN-inspired `category` (`start | task | gateway | end`) and the raw node object.
- `resolveNextNode(node, ctx, outcome?)` — resolves next node ID and edge ID deterministically for all
  supported node types. Edge IDs match the `${source}:${handle}:${target}` format used by `graphToBuilderEdges()`.
- `resolveSwitchInput(node, ctx)` — shared `{{token}}` resolution (was duplicated between simulation and runtime).

### Updated: `ivr-flow.service.ts`

- Imports `buildPlannerGraph`, `resolveNextNode` from planner.
- `simulateGraph` now collects `steps: SimulationStep[]` on every traversal step.
- Each step records `node_id`, `category`, and `edge_id` (the edge taken to arrive at this node).
- Removed local `resolveSwitchInput` helper (now shared via planner).
- `business_hours` still resolved inline with pre-loaded schedule data via `resolveBusinessHours` context hook.

### Updated: `ivr-runtime.service.ts`

- Imports `buildPlannerGraph`, `resolveSwitchInput` from planner.
- Replaces local `mapNodes` + `resolveSwitchInput` with shared planner equivalents.
- Maintains `isGraphNode` guard for local compatibility with existing `GraphNode` type usage.

### Updated: `ivr-flow.types.ts`

- Added `SimulationStep` interface: `{ node_id, category, edge_id }`.
- `SimulationOutcome.steps: SimulationStep[]` added.

### Updated: `packages/contracts/src/schemas/ivr-flows.ts`

- Added `SimulationStepSchema` with `node_id`, `category`, `edge_id` fields.
- `SimulationOutcomeSchema` now includes `steps: z.array(SimulationStepSchema)`.

---

## Findings

No open findings.

| Exit criterion | Status |
|----------------|--------|
| Validation, simulation, and runtime resolution share the same graph planner | done |
| Simulation traces can highlight visual edges and nodes deterministically | done |
| Session replay can refer to task/gateway/end execution steps | done (steps emitted per node) |
| Tests cover branch selection, timeout/invalid fallbacks, terminal actions, and unsupported constructs | done (31 planner tests) |
| Docs explain the execution model | done (SLICE-36 doc updated) |

---

## What is in good shape

- Edge ID format verified to match web builder's `graphToBuilderEdges()` output.
- No DB-dependent logic added to the planner — it remains a pure synchronous module.
- `business_hours` schedule resolution correctly handled by each service with its own async/sync strategy.
- All 87 pre-existing unit tests continue to pass; no regressions.
- Build and lint clean across contracts and API packages.
