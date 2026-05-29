# SLICE-16 Queue and Voicemail Models

## Goal

Add desired-state queue and voicemail resources as first-class telecom objects
rather than overloading the core IVR flow graph.

## Status

**PLANNED**

## Scope

- queue CRUD and membership model
- voicemail box CRUD and greeting model
- tenant-scoped validation rules for queue and voicemail targets
- IVR/routing target resolution for queue and voicemail
- event model additions for queue and voicemail outcomes

## Depends On

- `SLICE-06`
- `SLICE-07`
- `SLICE-15`

## Parallel With

- `SLICE-17`

## Unblocks

- queue node support
- voicemail destination support
- richer inbound routing options

## Exit Criteria

- queues and voicemail boxes exist as tenant-scoped desired-state resources
- inbound routes and IVR flows can target them through safe abstractions
- runtime documentation defines how FreeSWITCH executes them without exposing raw internals

## Out Of Scope

- full call center wallboard
- advanced agent desktop
- AI voicemail summarization as a default requirement
