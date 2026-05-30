# SLICE-35 BPMN-Inspired IVR Graph Model

## Goal

Define a constrained BPMN-inspired graph model for IVR authoring so the React
visual builder, backend validation, simulation, and runtime resolver all use the
same predictable execution semantics.

## Status

**PLANNED**

## Context

The existing IVR graph works as desired-state JSON and is already editable in the
visual builder. As flows grow more complex, the graph needs stronger state-machine
semantics. BPMN provides useful concepts: start events, tasks, gateways, sequence
flows, and end events. Full BPMN 2.0 is too broad for call execution and should
not become the runtime format.

This slice defines a manageCallAI-owned BPMN subset and maps it to the current
`graph_json` model.

## Scope

- Define the supported BPMN-inspired concepts:
  - start event
  - action task
  - exclusive gateway
  - terminal event
  - sequence flow
- Map existing IVR node types to the BPMN-inspired categories.
- Define edge condition semantics for menu choices, time branches, caller matches,
  timeout paths, invalid-input paths, and default branches.
- Add a graph metadata version such as `graph_model: "ivr-bpmn-v1"`.
- Update `docs/ivr/FLOW_SCHEMA.md` with the canonical subset.
- Update validation rules to reject unsupported BPMN constructs if import/export
  support is later added.
- Document that raw BPMN XML is not the canonical persisted runtime model.

## Does Not Change

- FreeSWITCH execution
- Lua helper behavior
- Database table ownership
- Provider/AI execution behavior

## Depends On

- `SLICE-08`
- `SLICE-15`
- `SLICE-17`
- `SLICE-23`

## Unblocks

- deterministic visual-builder behavior for complex flows
- cleaner simulation path explanation
- future BPMN import/export
- future AI-assisted flow generation against a constrained schema

## Exit Criteria

- docs define the supported BPMN-inspired subset and rejected BPMN features
- every implemented IVR node type maps to a start/task/gateway/end category
- graph edges have explicit branch semantics instead of implicit UI-only wiring
- validation rules identify unsupported constructs clearly
- existing `graph_json` remains the canonical API field

## Out Of Scope

- full BPMN 2.0 engine
- BPMN XML as canonical storage
- pools, lanes, message events, compensation, subprocess execution, and human tasks
- replacing React Flow with a BPMN editor
