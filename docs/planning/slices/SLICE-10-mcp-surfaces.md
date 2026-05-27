# SLICE-10 MCP Surfaces

## Goal

Expose safe MCP tools for AI agents over the same desired-state lifecycle as humans and workflows.

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
