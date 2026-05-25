# ADR-006: MCP Must Be Narrower Than the REST API

## Status

Accepted

## Date

2026-05-26

## Context

AI agents are a target user class, but they should not be granted the same breadth of operational access as human-admin or general automation surfaces.

The REST API serves broader system clients, while MCP exists specifically as a constrained, machine-usable safety layer for AI.

## Decision

The MCP interface must remain narrower than the REST API.

MCP should expose safe, intent-based operations for reading state, mutating drafts, validating changes, simulating behavior, and requesting publish actions, while excluding broad administrative parity and raw runtime control.

## Consequences

- AI integrations remain useful without inheriting full administrative reach.
- The MCP surface can be optimized for constrained schemas and auditable tool semantics.
- Some actions available through the REST API will remain intentionally unavailable through MCP.
- MCP capability expansion should be reviewed as a security and safety decision, not treated as ordinary feature parity work.

## Alternatives Considered

- Giving MCP feature parity with the REST API
- Allowing AI tools to issue raw switch-facing operations directly

## Notes

This ADR supersedes [ADR-0004](adr-0004-constrained-ai-access-through-mcp.md) as the clearer interface-boundary decision.
