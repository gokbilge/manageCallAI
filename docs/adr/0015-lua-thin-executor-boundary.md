# ADR-0015: Lua Is a Thin Runtime Executor

## Status

Accepted

## Date

2026-05-31

## Context

Lua runs inside the FreeSWITCH boundary and can affect live call execution. That
power makes it tempting to place routing, IVR, policy, or tenant logic there.
Doing so would create a second control plane that is harder to test, audit,
authorize, and expose safely to AI or workflow systems.

## Decision

Lua remains a thin executor. It may execute constrained runtime actions issued by
the API/runtime resolver, collect call-session input, and report outcomes.

Lua must not own:

- tenant or authorization policy
- IVR graph traversal logic
- publish, rollback, approval, or validation
- raw desired-state persistence
- AI prompt orchestration
- workflow or webhook delivery
- long-lived business state

## Consequences

- FreeSWITCH remains stock and portable.
- Runtime helpers are easier to audit and replace.
- More runtime decisions happen through API/agent round trips.
- Lua changes require boundary review when they add new actions or payload fields.

## Alternatives Considered

- Implementing IVR graph traversal in Lua.
- Generating large tenant-specific Lua scripts.
- Treating Lua scripts as a plugin system for business behavior.

## Notes

This ADR reinforces ADR-0004 and makes the boundary explicit for future code
review.
