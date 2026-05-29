# SLICE-27 Session Replay UI and API

## Goal

Give operators a clear replay view for IVR sessions so they can answer what happened
on a call without reading raw events or database rows.

## Status

**IMPLEMENTED**

## Context

The platform records runtime session state and session steps. Operators need a product
surface that turns that data into a trace: caller entered the flow, prompt played, digit
collected, branch selected, final action taken, or failure encountered.

## Scope

- Add tenant-scoped API endpoint to fetch an IVR session replay.
- Include session metadata, ordered steps, collected digits, selected branches, errors,
  final action, and linked call events where available.
- Add operator UI route from runtime sessions/call events into a replay detail page.
- Render replay as an ordered timeline suitable for support/debug workflows.
- Add empty/error states for incomplete or missing session data.
- Add tests for tenant isolation, replay shape, and UI rendering.

## Depends On

- `SLICE-19`
- `SLICE-22`

## Parallel With

- `SLICE-25`
- `SLICE-26`

## Unblocks

- operator debugging
- support workflows
- MCP and n8n session trace tools

## Exit Criteria

- tenant operators can open a session replay from the web UI
- replay API never exposes another tenant's sessions
- replay response is stable enough for future MCP/n8n tools
- tests cover replay assembly and web rendering

## Out Of Scope

- live real-time call monitoring
- waveform/audio playback
- AI-generated call summaries
- cross-tenant platform analytics
