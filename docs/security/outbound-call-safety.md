# Outbound Call Safety

## Current Model

Outbound call creation is mediated by the API. The service validates the dial
number, blocks global emergency and premium-rate destinations, resolves an active
outbound route, applies route allow/block prefixes, checks the resolved trunk is
active, then enforces the route `max_calls_per_minute` cap before persistence.

Current controls:

- Global emergency destination block.
- Global premium-rate prefix block.
- Route destination allowlist through `allowed_destination_prefixes_json`.
- Route destination blocklist through `blocked_destination_prefixes_json`.
- Route-level attempt cap through `max_calls_per_minute`.
- Tenant-level outbound policy at `GET/PUT /api/v1/fraud/outbound-policy`.
- Tenant country allowlist through `country_allowlist`.
- Tenant area-code allowlist through `areacode_allowlist`.
- Tenant premium-rate and high-risk prefix blocklists.
- Tenant hourly and daily call caps.
- API rate limit for `POST /api/v1/runtime/outbound`.
- Tenant-scoped outbound request storage and lookup.

## Policy Design

Route-level controls are layered with a tenant-level outbound policy object.
The policy is managed through `/api/v1/fraud/outbound-policy` and is guarded by
`tenant.fraud_policy.view` and `tenant.fraud_policy.manage`.

Implemented fields:

- `tenant_id`
- `country_allowlist`: E.164 country prefixes such as `+1`, `+44`, `+90`
- `areacode_allowlist`: specific prefixes such as `+1415`, `+4420`
- `premium_rate_blocklist`: configurable prefix set layered on top of global defaults
- `high_risk_blocklist`
- `max_calls_per_hour`
- `max_calls_per_day`
- `max_call_duration_secs`
- `deny_international_default`
- `created_at`, `updated_at`

Evaluation order:

1. Normalize dialed number to E.164-compatible digits.
2. Reject malformed, emergency, premium-rate, and high-risk destinations.
3. Apply tenant country and area-code allowlists.
4. Resolve route and apply route allow/block lists.
5. Verify trunk state.
6. Apply route-level attempt caps.
7. Persist request and emit audit events for created, blocked, and terminal outcomes.

## Operational Guidance

- Default new tenants to deny international outbound until an operator configures
  country allowlists.
- Keep premium-rate blocks global and non-bypassable unless a platform operator
  explicitly grants a temporary exception.
- Keep emergency calling out of this platform until regulatory routing, address,
  and dispatch requirements are implemented.
- Use allowlists for business destinations; do not rely only on blocklists.
- Alert on blocked attempts. A blocked call is a security signal, not just a
  validation error.

## Tests

Existing service tests cover malformed numbers, emergency block, premium block,
route allow/block prefixes, active trunk checks, route rate caps, tenant policy
country/area-code allowlists, tenant high-risk and premium blocklists, hourly and
daily caps, and blocked-attempt audit emission.

Remaining production-hardening follow-ups:

- enforce `max_call_duration_secs` in the runtime dispatch contract
- add concurrent outbound-call caps if the runtime worker supports concurrency tracking
- add platform-operated temporary exceptions for carefully reviewed premium destinations
