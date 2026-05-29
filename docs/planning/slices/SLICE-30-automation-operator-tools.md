# SLICE-30 Automation Operator Tools

## Goal

Expand MCP and n8n-facing automation around real operator workflows: approvals,
session trace, recordings, and exports.

## Status

**IMPLEMENTED**

## Context

The current automation surfaces prove safe lifecycle access. After webhook delivery and
session replay are stronger, automation should expose the same operational workflows
that humans use rather than inventing separate AI-only capabilities.

## Scope

- Add MCP tools for listing pending approvals and approving/rejecting requests where
  capability checks allow it.
- Add MCP read tools for session replay and recording metadata.
- Add MCP read tools for recording analysis request status, transcript text, and
  summary text when available.
- Add MCP/export helper for bounded call-event/session exports.
- Add n8n-oriented examples for approval and session-debug workflows.
- Keep tools narrower than the REST API and preserve tenant/capability boundaries.
- Add tests for tool input validation and API error mapping.

## Depends On

- `SLICE-20`
- `SLICE-25`
- `SLICE-27`
- `SLICE-28`

## Parallel With

- `SLICE-28`
- `SLICE-29`

## Unblocks

- agent-assisted operations
- richer n8n playbooks
- support/debug workflows without direct database access

## Exit Criteria

- MCP can list and decide approvals through constrained tools
- MCP can fetch session replay and recording metadata without exposing raw internals
- MCP can fetch recording analysis status/results through the same provider-neutral
  contract used by REST
- n8n documentation includes at least one approval workflow and one failed-call debug workflow
- tests cover authorization-sensitive tool behavior

## Out Of Scope

- natural-language flow generation
- autonomous production publish without human policy
- custom packaged n8n community node
- unrestricted data export
