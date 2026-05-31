# ADR-0012: MCP and Workflow Surfaces Stay Narrower Than REST

## Status

Accepted

## Date

2026-05-31

## Context

AI agents and workflow engines are first-class users, but they are not trusted
operator shells. They need safe, goal-oriented operations over telecom business
objects, not raw runtime control.

The repository already has ADR-006 for MCP. n8n and webhook examples need the
same boundary because workflow automations can otherwise become another route to
raw FreeSWITCH, XML, ESL, or shell-like control.

## Decision

MCP and n8n/workflow integrations must remain narrower than REST.

They may expose constrained tools and workflows for reading state, drafting
changes, validating, simulating, requesting publish, and reacting to business
events. They must not expose:

- raw ESL commands
- arbitrary FreeSWITCH XML editing
- shell-like runtime control
- direct database mutation
- unbounded provider payload injection
- endpoints that bypass validation, authorization, audit, or lifecycle checks

## Consequences

- AI and workflow automation remain useful without inheriting the full operator
  or runtime attack surface.
- New MCP tools and workflow templates must be reviewed as security-boundary
  changes, not as simple REST parity additions.
- Some REST actions will intentionally have no MCP or n8n equivalent.

## Alternatives Considered

- MCP parity with REST.
- n8n templates that call runtime-internal endpoints directly.
- Raw FreeSWITCH command or XML tools guarded only by documentation.

## Notes

This ADR extends `adr-006-mcp-must-be-narrower-than-rest-api.md` to all
AI/workflow integration surfaces.
