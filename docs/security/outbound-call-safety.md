# Outbound Call Safety

## Current Model

Outbound call creation is mediated by the API. The service validates the dial
number, blocks global emergency and premium-rate destinations, resolves an active
outbound route, applies route allow/block prefixes, checks the resolved trunk is
active, then enforces the route `max_calls_per_minute` cap before persistence.

Existing controls:

- Global emergency destination block.
- Global premium-rate prefix block.
- Route destination allowlist through `allowed_destination_prefixes_json`.
- Route destination blocklist through `blocked_destination_prefixes_json`.
- Route-level attempt cap through `max_calls_per_minute`.
- API rate limit for `POST /api/v1/runtime/outbound`.
- Tenant-scoped outbound request storage and lookup.

## Policy Design

The next policy tier should make route-level controls easier to operate by adding
a tenant-level outbound policy object.

Recommended fields:

- `tenant_id`
- `enabled`
- `country_allowlist`: E.164 country prefixes such as `+1`, `+44`, `+90`
- `area_code_allowlist`: specific prefixes such as `+1415`, `+4420`
- `premium_rate_blocklist`: configurable prefix set layered on top of global defaults
- `high_risk_country_blocklist`
- `max_call_duration_seconds`
- `max_calls_per_minute`
- `max_calls_per_hour`
- `max_concurrent_outbound_calls`
- `alert_thresholds_json`
- `updated_by`, `updated_at`

Evaluation order:

1. Normalize dialed number to E.164-compatible digits.
2. Reject malformed, emergency, premium-rate, and high-risk destinations.
3. Apply tenant country and area-code allowlists.
4. Resolve route and apply route allow/block lists.
5. Verify trunk state and trunk-specific limits.
6. Apply tenant, route, and trunk rate/concurrency limits.
7. Persist request with decision metadata and audit outcome.

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
route allow/block prefixes, active trunk checks, and route rate caps. Additional
tests should be added with the tenant policy object:

- country allowlist permits only configured countries
- area-code allowlist can narrow a broad country route
- tenant hourly cap blocks persistence
- max duration is passed to the runtime dispatch contract
- blocked attempts create audit and alert events
