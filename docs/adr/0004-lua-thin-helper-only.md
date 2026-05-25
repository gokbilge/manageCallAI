# ADR-0004: Lua as Thin Helper Only

## Status

Accepted

## Date

2026-05-26

## Decision

Use Lua inside FreeSWITCH only as a thin execution helper.

## Rationale

- Business logic belongs in the manageCallAI backend, not inside switch-local scripts.
- Thin Lua helpers are easier to audit, replace, and keep compatible with stock FreeSWITCH installations.
- This keeps call-flow decisions, AI behavior, workflow orchestration, validation, and publish logic out of the switch runtime.

## MVP Scope

- `play_prompt`
- `play_collect`
- `transfer`
- `hangup`
- `set_variable`
- call backend API for next-step execution instructions

## Consequences

- Lua stays intentionally limited and should not grow into a second backend.
- More backend/API round-trips are expected, but the architecture remains cleaner and easier to adopt.
