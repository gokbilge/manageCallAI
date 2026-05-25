# ADR-0004: AI Access Must Be Constrained Through MCP

## Status

Accepted

## Date

2026-05-26

## Context

AI agents are a target user class, but unrestricted access to telecom infrastructure would create excessive operational and security risk.

The system needs a machine-usable interface that is intentionally narrower than general administrative access.

## Decision

AI agents will interact with `manageCallAI` through a constrained MCP surface.

The MCP interface will support business-level read, draft mutation, validation, simulation, and publish-request operations, while explicitly disallowing raw XML editing, unrestricted shell-like actions, and direct FreeSWITCH command execution.

## Consequences

- AI integrations can be useful without being over-privileged.
- Tool schemas and policy enforcement become a core part of system safety.
- Some tasks available to human administrators may remain intentionally unavailable to AI agents.
- The MCP surface must be maintained as a separate trust boundary with explicit controls.

## Alternatives Considered

- Giving AI agents direct REST parity with administrative clients
- Allowing AI agents to issue raw switch-level commands

## Notes

This decision should shape both API design and security architecture.
