# Webhook Delivery: Signing, Replay Protection, and Idempotency

This document describes the security model for automation webhook delivery.

---

## Signature Verification

Every webhook delivery includes two HTTP headers:

| Header | Value |
|---|---|
| `X-ManageCallAI-Timestamp` | Unix epoch seconds (UTC) at delivery time |
| `X-ManageCallAI-Signature` | `sha256=<HMAC-SHA256 hex>` |

The signature is computed as:

```
HMAC-SHA256(signing_secret, "<timestamp>.<raw_body_bytes>")
```

Where:
- `signing_secret` — the webhook's per-endpoint signing secret (returned once on creation)
- `timestamp` — the value of `X-ManageCallAI-Timestamp`
- `raw_body_bytes` — the raw UTF-8 request body (JSON)

### Verification example (Node.js)

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

function verifyWebhook(secret, rawBody, sigHeader, tsHeader) {
  if (!sigHeader || !tsHeader) return false;
  const ts = parseInt(tsHeader, 10);
  if (!Number.isFinite(ts)) return false;
  // Replay protection: reject deliveries older than 5 minutes
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  const a = Buffer.from(sigHeader, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
```

---

## Replay Protection

The platform rejects any webhook consumer that presents a timestamp more than **300 seconds** (5 minutes) from the current server time. This window protects against replay attacks where an attacker captures a valid delivery and retransmits it later.

Requirements for webhook consumers:
1. Validate the `X-ManageCallAI-Timestamp` header is within 300 seconds of your server clock.
2. Reject deliveries outside this window with HTTP 400.

---

## Idempotency

Webhook payloads include an `event_id` field (UUID). The platform guarantees at-most-once delivery per `(webhook_id, event_id)` pair — the delivery queue uses `ON CONFLICT DO NOTHING` to deduplicate.

However, network conditions may cause the platform to re-attempt delivery if no 2xx response is received within the timeout window (even if the consumer processed the event). Consumers **must** implement idempotency:

1. Store processed `event_id` values.
2. If a delivery arrives with a previously seen `event_id`, return HTTP 200 without reprocessing.

Idempotency key lifetime: retain processed `event_id` values for at least 24 hours.

### Delivery retry schedule

| Attempt | Delay |
|---|---|
| 1 | Immediate |
| 2 | 30 seconds |
| 3 | 2 minutes |
| 4 | 10 minutes |
| 5–10 | Exponential backoff up to 1 hour |

After 10 failed attempts, the delivery is marked `abandoned` and appears in the webhook backlog.

---

## Event Payload Shape

```json
{
  "event": "ivr_flow.published",
  "event_id": "7f3a2b1c...",
  "tenant_id": "...",
  "occurred_at": "2026-06-02T12:00:00.000Z",
  "data": { }
}
```

See `docs/examples/n8n/` for complete payload shapes per event type.

---

## Security Considerations

- Signing secrets are never returned after initial creation. Rotate via `POST /api/v1/automation/webhooks/{id}/rotate-secret`.
- Webhook consumers should serve HTTPS only. HTTP endpoints are accepted but not recommended.
- Use timing-safe comparison (`timingSafeEqual`) when verifying signatures to prevent timing oracle attacks.
