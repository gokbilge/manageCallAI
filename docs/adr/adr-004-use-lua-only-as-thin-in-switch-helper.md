# ADR-004: Use Lua Only as a Thin In-Switch Helper

## Status

Accepted

## Date

2026-05-26

## Context

Some call-session actions must execute inside FreeSWITCH at call time, but placing business logic inside Lua scripts would fragment system behavior and create an additional decision-making layer inside the telecom runtime.

The project philosophy is to keep business logic in the `manageCallAI` backend and use switch-side code only when runtime-local execution is necessary.

## Decision

Lua will be used only as a thin in-switch helper layer.

For MVP, Lua is limited to action execution such as:

- `play_collect`
- `play_prompt`
- `transfer`
- `hangup`
- `set_variable`
- call API for next step

Lua must not contain business logic.

## Consequences

- Call-session execution remains possible without moving orchestration into FreeSWITCH.
- The backend remains the single source of business decision-making.
- Lua scripts should stay small, mechanical, and easy to replace or audit.
- Additional switch-side behavior must be scrutinized carefully to avoid accidental business-logic creep.

## Alternatives Considered

- Implementing richer call-flow decision logic directly in Lua
- Avoiding Lua entirely even for thin call-session helpers

## Notes

This ADR sharpens the FreeSWITCH integration boundary and should guide all future switch-side scripting.
