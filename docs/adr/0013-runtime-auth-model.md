# ADR-0013: Runtime Authentication Is Separate From User Authentication

## Status

Accepted

## Date

2026-05-31

## Context

`manageCallAI` has public/operator API traffic, AI/MCP traffic, workflow traffic,
and runtime-internal traffic from FreeSWITCH-facing components. These actors have
different trust properties and must be distinguishable in authorization, audit,
rate limits, and incident review.

## Decision

Runtime-internal access uses explicit runtime credentials and runtime-scoped
endpoints. It is not a substitute for user, API key, MCP session, or workflow
authorization.

The API must distinguish at least these actor classes:

- human user
- automation API key
- MCP or AI session/tool
- workflow/webhook actor
- runtime agent or FreeSWITCH runtime callback

Runtime endpoints may return runtime-generated artifacts such as XML projections
or constrained IVR actions, but they must not accept broad business mutations or
administrative commands.

## Consequences

- Audit trails can identify whether a change was caused by a human, AI tool,
  workflow, API key, or runtime component.
- Runtime secrets can be rotated and scoped separately from user credentials.
- Runtime callbacks remain narrow consumers/producers of active state, not a
  second admin API.
- More explicit auth plumbing is required across API, Go agent, Lua, and
  FreeSWITCH `mod_xml_curl`.

## Alternatives Considered

- Share user tokens with runtime components.
- Authenticate runtime callbacks only by network placement.
- Let runtime components call normal admin mutation endpoints.

## Notes

Runtime tokens should never appear in query strings or logs. Runtime-generated
artifacts must be derived from published desired state.
