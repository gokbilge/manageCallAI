# ADR-0016: IVR Graphs Are Business Objects, Not BPMN XML

## Status

Accepted

## Date

2026-05-31

## Context

The IVR builder uses BPMN-inspired concepts such as start events, tasks,
gateways, sequence flow, and terminal events. Full BPMN 2.0 XML is much broader
than the runtime needs and can encode constructs that are unsafe or irrelevant
for deterministic call execution.

## Decision

IVR graphs are manageCallAI business objects stored as validated desired state.
They are not FreeSWITCH XML and not BPMN XML.

BPMN may inform the graph vocabulary, import/export, and visual language, but the
canonical persisted model is the manageCallAI IVR graph schema. Unsupported BPMN
constructs must be rejected or translated through an explicit import step before
validation.

Runtime execution consumes planner output and constrained runtime actions, never
raw BPMN XML.

## Consequences

- IVR validation and simulation stay under project control.
- Runtime behavior remains deterministic and tenant-safe.
- Future BPMN import/export can exist without making BPMN the source of truth.
- Contributors must add new graph semantics to contracts, validation, simulation,
  planner/runtime resolver, docs, and tests together.

## Alternatives Considered

- Persist full BPMN 2.0 XML as the canonical IVR model.
- Generate FreeSWITCH XML directly from visual editor nodes.
- Use a generic BPMN engine as the call execution engine.

## Notes

This ADR refines ADR-0009 for the BPMN-inspired graph model introduced later in
the project.
