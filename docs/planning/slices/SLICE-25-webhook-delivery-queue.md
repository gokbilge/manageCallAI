# SLICE-25 Webhook Delivery Queue

## Goal

Make outbound webhook delivery durable and observable enough for release use by n8n
and external automation consumers.

## Status

**IMPLEMENTED**

## Context

Current webhook delivery is fire-and-forget from the API process. It records delivery
attempts and retries in-process, but retries are lost if the API restarts and there is
no operator-facing queue state. For a release, automation events should survive process
restarts and expose enough state to diagnose integration failures.

## Scope

- Add a Postgres-backed webhook delivery queue.
- Enqueue outbound events transactionally after the primary action succeeds.
- Add a worker loop that claims due deliveries, sends them, records attempts, and
  schedules retries.
- Persist delivery state: pending, processing, delivered, failed, abandoned.
- Use bounded retry policy with backoff and max attempts.
- Keep signing behavior and event payload contract compatible with existing webhooks.
- Add delivery status/list API for tenant operators.
- Add tests for enqueue, claim, retry, abandon, and tenant-scoped status reads.

## Depends On

- `SLICE-12`
- `SLICE-20`

## Parallel With

- `SLICE-26`
- `SLICE-27`

## Unblocks

- reliable n8n triggers
- safer automation integrations
- webhook operational dashboards

## Exit Criteria

- webhook deliveries are persisted before dispatch
- failed deliveries retry after API/worker restart
- delivery attempts and final state are visible through tenant-scoped APIs
- existing webhook subscriptions continue to receive the same signed payload shape
- CI covers queue state transitions and failure paths

## Out Of Scope

- Redis or external message broker dependency
- exactly-once delivery guarantee
- custom n8n node package
- per-tenant custom retry policy
