# SLICE-15 Advanced IVR Node Types

## Goal

Expand the published IVR flow model beyond the v1 node set while preserving the
same desired-state, validate, simulate, publish, and runtime-execute lifecycle.

## Status

**COMPLETED**

Shipped in this slice:

- `caller_id_match`
- `set_variable`
- `queue`
- `voicemail_drop`

These now work through validation, simulation, backend runtime resolution, and
the visual IVR builder.

## Scope

- add advanced node types on top of the existing flow graph model
- extend validator and simulator for the new node contracts
- extend runtime resolver and FreeSWITCH runtime loop only through safe actions
- document each new node type in flow schema and runtime docs

## Initial Candidate Nodes

- `transfer_external`
- `http_request`
- `sub_flow`
- `a_b_test`
- speech-capable gather node if ASR dependency is chosen explicitly

## Depends On

- `SLICE-04`
- `SLICE-05`
- `SLICE-08`

## Parallel With

- `SLICE-19`

## Unblocks

- richer IVR authoring
- more production-realistic routing behavior
- future AI-assisted flow authoring with broader primitives

## Exit Criteria

- at least one meaningful advanced node ships end to end
- validator, simulator, and runtime resolver all understand the shipped nodes
- visual builder can create and edit the shipped nodes
- docs and OpenAPI reflect only implemented node types

## Out Of Scope

- queue semantics
- voicemail semantics
- outbound routing policy
