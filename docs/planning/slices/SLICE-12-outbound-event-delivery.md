# SLICE-12 Outbound Event Delivery

## Goal

Deliver IVR lifecycle events to tenant-registered webhook endpoints,
enabling n8n workflows and other external consumers to react to
publish, rollback, validation, and approval outcomes without polling.

## Context

`docs/ivr/N8N_AND_MCP_PROGRAMMABILITY.md` defines the event names the
system should emit. The n8n and MCP surfaces (SLICE-09, SLICE-10) depend
on those events being deliverable. This slice builds that delivery
infrastructure as a first-class desired-state object.

## Scope

### Webhook subscription management

- `POST /api/v1/webhooks` — register a callback URL with optional event category filter
- `GET /api/v1/webhooks` — list active subscriptions for the tenant
- `DELETE /api/v1/webhooks/:id` — remove a subscription
- Subscription fields: `url`, `event_categories[]`, `active`, `secret`

### Outbound event delivery

- Fire-and-forget POST to all matching subscriptions when lifecycle events fire
- Events to deliver on first pass:
  - `ivr.publish_requested` — emitted when a publish attempt creates an approval request
  - `ivr.published` — emitted when a version is directly published
  - `ivr.rollback_completed` — emitted when rollback succeeds
  - `ivr.validation_failed` — emitted when `validate` returns a failed outcome
- Delivery payload: `{ event, tenant_id, flow_id, version_id, timestamp, data }`
- HMAC-SHA256 signature header (`X-ManageCallAI-Signature`) using the subscription secret

### Reliability baseline

- Single delivery attempt per event (fire-and-forget is sufficient for this slice)
- Log delivery failures without blocking the originating API response
- Deactivate subscription after configurable consecutive failures (default: 5)

## Depends On

- `SLICE-00`

## Parallel With

- `SLICE-02`
- `SLICE-03`
- `SLICE-04`

## Unblocks

- `SLICE-09` (n8n event-driven workflows — n8n needs to receive events, not just trigger actions)
- `SLICE-10` (MCP approval notifications)

## Exit Criteria

- tenant can register a callback URL scoped to one or more event categories
- IVR publish, rollback, validation-failed, and publish-requested events are
  delivered to matching subscriptions
- each delivery includes a verifiable HMAC-SHA256 signature
- delivery failure does not block or slow the originating API response
- web UI lists registered subscriptions (read-only view is sufficient at this slice)

## Out Of Scope

- guaranteed delivery / message queue / at-least-once semantics
- retry with exponential backoff (log-and-fail is sufficient at this slice)
- consumer SDK or n8n trigger node
- call-level events (`call.ivr_entered`, `call.ivr_completed`) — those require the
  runtime resolver and belong to SLICE-09 after SLICE-04/05 are complete
