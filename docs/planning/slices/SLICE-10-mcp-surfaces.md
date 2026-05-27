# SLICE-10 MCP Surfaces

## Goal

Expose safe MCP tools for AI agents over the same desired-state lifecycle as humans and workflows.

## Status

**CLOSED** — 2026-05-28

15/15 unit tests green (`apps/mcp/src/tools/ivr-flows.test.ts`):

- ✓ `list_ivr_flows`, `get_ivr_flow`, `create_ivr_flow`, `update_flow_definition`
- ✓ `validate_flow` (soft 422 vs hard error distinction)
- ✓ `simulate_flow` (optional fields, soft 422)
- ✓ `request_publish`, unknown tool guard

## Scope

- list and inspect IVR flows
- create and modify drafts
- validate and simulate flows
- request publish
- explain flow structure and simulation outcomes

## Depends On

- `SLICE-02`
- `SLICE-04`

## Parallel With

- `SLICE-08`
- `SLICE-09`

## Unblocks

- AI-safe telecom programming story

## Exit Criteria

- AI agent can produce drafts, run validation and simulation, and request publish
- no raw FreeSWITCH, ESL, XML, or Lua execution is exposed

## Out Of Scope

- unrestricted agent autonomy
