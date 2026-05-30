# SLICE-36 Visual IVR Execution Engine

## Goal

Align the React visual builder, backend simulator, and runtime resolver around the
BPMN-inspired graph semantics from SLICE-35 so visual connections execute exactly
as operators expect.

## Status

**PLANNED**

## Context

The visual builder already edits IVR graphs, and the backend already validates,
simulates, publishes, and executes them. The next step is to make the graph
execution model explicit enough that a visual edge, simulation step, and runtime
advance all mean the same thing.

## Scope

- Add a shared execution planner that normalizes `graph_json` into executable nodes
  and typed sequence flows.
- Use the same planner in validation, simulation, and runtime resolution.
- Produce deterministic simulation traces using BPMN-style step categories:
  `start`, `task`, `gateway`, `end`.
- Add backend trace metadata that the React builder can highlight as the simulated
  or executed path.
- Ensure runtime resolver only emits constrained Lua actions after planner
  evaluation.
- Add tests proving visual edge semantics match simulator and runtime resolver paths.
- Update replay documentation so session replay can reference the same execution
  categories.

## Does Not Change

- Lua remains a thin executor.
- FreeSWITCH does not receive raw graph or BPMN definitions.
- The visual builder remains a React Flow surface unless a separate UI decision is
  made later.

## Depends On

- `SLICE-35`
- `SLICE-04`
- `SLICE-05`
- `SLICE-27`

## Parallel With

- future AI-assisted flow generation
- future simulation-suite work

## Unblocks

- richer visual simulation preview
- more reliable runtime/session replay explanations
- safer AI-generated draft validation
- eventual BPMN import/export without changing runtime execution

## Exit Criteria

- validation, simulation, and runtime resolution share the same graph planner
- simulation traces can highlight visual edges and nodes deterministically
- session replay can refer to task/gateway/end execution steps
- tests cover branch selection, timeout/invalid fallbacks, terminal actions, and
  unsupported constructs
- docs explain the execution model from visual authoring to Lua action output

## Out Of Scope

- full BPMN token engine
- parallel gateways or concurrent IVR branches
- human task orchestration
- provider-driven AI branching without bounded result validation

