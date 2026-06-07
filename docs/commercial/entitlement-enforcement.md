# Entitlement Enforcement

## Single Enforcement Point

`EntitlementService` (at `apps/api/src/modules/entitlement/entitlement.service.ts`)
is the only place in the codebase that evaluates and enforces edition limits.
Controllers call `entitlementSvc.assertWithinLimit()` or
`entitlementSvc.assertFeature()` before delegating to the domain service.

All entitlement checks go through `EntitlementService`. There is no enforcement
in FreeSWITCH, Lua scripts, or the Go agent. Live call routing is never blocked
by entitlement checks.

## How assertWithinLimit Works

```
assertWithinLimit(tenantId, capabilityKey, requestedIncrement=1)
  1. getEntitlement() — resolves the effective limit:
     a. Look up active tenant_entitlement_overrides for the key.
     b. If override found, use it (supports higher or lower than plan).
     c. Otherwise, look up the plan via tenant_subscriptions (or default Free plan).
     d. Fetch commercial_plan_entitlements for that plan.
  2. If is_contract AND limit is null — non-blocking (Enterprise pass-through).
  3. If limit is null — unlimited.
  4. Get current usage:
     a. Monthly-counter keys: query tenant_usage_counters for the current period.
     b. Object-count keys: SELECT COUNT(*) from the mapped resource table.
  5. If current + requestedIncrement > limit, throw EntitlementLimitExceededError.
```

## Monthly Counters

The following capability keys use `tenant_usage_counters` (rolling monthly totals)
rather than live object-count queries:

- `call_events.monthly_limit`
- `ai.failure_explanation.monthly_limit`
- `ai.route_risk.monthly_limit`
- `ai.summary.monthly_limit`
- `ai.nl_report.monthly_limit`
- `migration.analysis.monthly_limit`
- `migration.draft_import.monthly_limit`

Counters are incremented via `entitlementSvc.recordUsage()`, which also writes a
`usage_events` row for audit purposes. Idempotency keys can be passed to prevent
double-counting.

## Error Shape for ENTITLEMENT_LIMIT_EXCEEDED

When a limit is exceeded, the API returns HTTP 429 with:

```json
{
  "error": "ENTITLEMENT_LIMIT_EXCEEDED",
  "capability": "extension.max_count",
  "plan": "free",
  "limit": 25,
  "current": 25,
  "upgrade_hint": "Upgrade to Pro or Enterprise to increase this limit.",
  "request_id": "..."
}
```

## Controller Integration Pattern

Each create handler checks the entitlement before calling the domain service:

```typescript
async (req, reply) => {
  const user = req.user as AuthClaims;
  try {
    await entitlementSvc.assertWithinLimit(user.tenant_id, 'extension.max_count');
  } catch (err) {
    if (err instanceof EntitlementLimitExceededError) return sendEntitlementLimitExceeded(reply, err);
    throw err;
  }
  // ... proceed with create
}
```

## Wired Controllers (v0.7.5)

The following create handlers enforce entitlement limits:

| Resource | Controller | Capability Key |
|----------|-----------|----------------|
| Extension | `extension.controller.ts` | `extension.max_count` |
| Device | `device.controller.ts` | `device.max_count` |
| SIP Trunk | `sip-trunk.controller.ts` | `sip_trunk.max_count` |
| Phone Number (DID) | `phone-number.controller.ts` | `did.max_count` |
| Inbound Route | `inbound-route.controller.ts` | `route.inbound.max_count` |
| Outbound Route | `outbound-route.controller.ts` | `route.outbound.max_count` |
| IVR Flow | `ivr-flow.controller.ts` | `ivr.flow.max_count` |
| Queue | `queue.controller.ts` | `queue.max_count` |
| Call Group (Ring Group) | `call-group.controller.ts` | `ring_group.max_count` |
| Voicemail Box | `voicemail-box.controller.ts` | `voicemail_box.max_count` |
| Conference Room | `conference-room.controller.ts` | `conference_room.max_count` |
| Parking Lot | `parking-lot.controller.ts` | `parking_lot.max_count` |
| Schedule | `schedule.controller.ts` | `schedule.max_count` |
| Feature Code | `feature-code.controller.ts` | `feature_code.max_count` |
| API Key | `automation.controller.ts` (POST /keys) | `api_key.max_count` |
| Webhook | `automation.controller.ts` (POST /webhooks) | `webhook.max_count` |

## Pending Integrations (v0.7.6+)

The following resources have entitlement limits defined in the DB but are not
yet wired in controller create handlers:

- `user.admin.max_count` / `user.end_user.max_count` — user provisioning
- `tenant.max_count` — tenant creation (platform admin)
- `n8n.connection.max_count` — n8n workflow connections
- `holiday_calendar.max_count` — holiday calendar create
- `ivr.version.max_per_flow` — IVR version creation
- `call_events.monthly_limit` — call event ingestion (runtime path)
- AI monthly counters — wired at call site when AI features are invoked
- Storage limits (`recording.storage_mb`, `voicemail.storage_mb`, `transcript.storage_mb`) — require storage accounting integration
- Retention limits (`call_events.retention_days`, `audit.retention_days`, etc.) — inform retention jobs, not create-time blocks
