# SLICE-20 Automation and AI Depth

## Goal

Extend the existing n8n and MCP foundations into richer, approval-aware,
production-safe automation surfaces.

## Status

**COMPLETED** — 2026-05-29

### Shipped

- New webhook events: `approval.requested`, `call.completed`, `outbound_call.dispatched` added to `WEBHOOK_EVENTS`
- Webhook delivery log: `webhook_delivery_log` table (migration `0017_webhook_delivery_log.sql`) records every attempt with status, response code, and duration
- Delivery retry: up to 3 attempts per target with 2s then 10s delays; each attempt logged to DB
- Delivery history endpoint: `GET /api/v1/webhooks/:id/deliveries` returns recent delivery attempts for operator observability
- `AutomationService.getDeliveryHistory()` with tenant ownership check
- MCP approvals tools (`list_approvals`, `get_approval`, `decide_approval`) in `apps/mcp/src/tools/approvals.ts`
- MCP prompts tools (`list_prompts`, `get_prompt`) in `apps/mcp/src/tools/prompts.ts`
- MCP runtime tools (`list_sessions`, `get_session`) in `apps/mcp/src/tools/runtime.ts`
- MCP schedules tool (`list_schedules`) in `apps/mcp/src/tools/schedules.ts`
- `run_simulation_suite` MCP tool: runs multiple named scenarios against a flow draft and returns aggregated pass/fail results — usable as a pre-publish regression gate by AI agents
- MCP server version bumped to 0.2.0; index wires all new tools; 25/25 MCP tests pass

## Scope

- stronger webhook delivery semantics and retry model
- richer MCP tool coverage around approvals, prompts, and runtime inspection
- AI-assisted flow authoring on top of the desired-state lifecycle
- regression simulation libraries usable by automation and AI agents

## Depends On

- `SLICE-09`
- `SLICE-10`
- `SLICE-19`

## Parallel With

- `SLICE-21`

## Unblocks

- more capable automation stories
- safer AI-assisted operations
- enterprise-grade integration breadth

## Exit Criteria

- automation surfaces remain approval-aware and policy-bound
- AI tools stay within safe abstractions and never expose raw telecom internals
- delivery and audit behavior is strong enough for production automation claims

## Out Of Scope

- fully autonomous production changes with no policy boundary
- direct raw runtime command tools
