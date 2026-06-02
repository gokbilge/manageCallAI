# Rate-Limit Topology

The API has in-process rate limits. They are useful for local, alpha, and
single-instance production deployments. They are not sufficient by themselves
for horizontally scaled production.

Run:

```sh
pnpm production:rate-limit-check
```

## Accepted Production Topologies

| Topology | Required Evidence |
|---|---|
| Single API instance | explicit `RATE_LIMIT_*` values and edge allowlists |
| Multiple API instances with edge limiter | `EDGE_RATE_LIMIT_ENFORCED=true` and gateway policy evidence |
| Multiple API instances with shared limiter | `RATE_LIMIT_EXTERNAL_ENFORCED=true` and named `RATE_LIMIT_STORE` |

For multi-instance deployments, at least one of the shared limiter paths is
required. Otherwise, each instance enforces a separate quota and attackers can
multiply allowed request volume by spreading traffic across instances.

## Recommended Production Values

Set these in your production `.env` or container environment to eliminate check warnings:

```sh
# Single-instance production (adjust to your capacity)
MANAGECALLAI_INSTANCE_COUNT=1
RATE_LIMIT_WINDOW_MS=60000        # 1-minute sliding window

# Auth endpoints (login, register, token refresh)
RATE_LIMIT_AUTH_MAX=20            # 20 auth requests per IP per minute

# FreeSWITCH runtime callbacks (dialplan, directory, event ingest)
RATE_LIMIT_RUNTIME_MAX=300        # 300 runtime calls per node per minute

# Webhook inbound delivery (from automation consumers)
RATE_LIMIT_WEBHOOK_MAX=100        # 100 webhook deliveries per tenant per minute

# Outbound call dispatch
RATE_LIMIT_OUTBOUND_MAX=30        # 30 outbound call requests per tenant per minute
```

For multi-instance production, also set one of:

```sh
# Option A: Edge enforced
EDGE_RATE_LIMIT_ENFORCED=true

# Option B: Redis shared store
RATE_LIMIT_STORE=redis
RATE_LIMIT_REDIS_URL=redis://redis:6379
RATE_LIMIT_REDIS_KEY_PREFIX=managecallai:rate-limit
```

## All Production Variables

- `MANAGECALLAI_INSTANCE_COUNT`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_AUTH_MAX`
- `RATE_LIMIT_RUNTIME_MAX`
- `RATE_LIMIT_WEBHOOK_MAX`
- `RATE_LIMIT_OUTBOUND_MAX`
- `RATE_LIMIT_EXTERNAL_ENFORCED`
- `RATE_LIMIT_STORE`
- `RATE_LIMIT_REDIS_URL`
- `RATE_LIMIT_REDIS_KEY_PREFIX`
- `EDGE_RATE_LIMIT_ENFORCED`

## API Rate-Limit Stores

The default `InMemoryRateLimiter` in `apps/api/src/security/rate-limit.ts` maintains
separate quota buckets per process. It is safe for single-instance deployments. It
is **not** safe for multi-instance horizontal scaling because each instance enforces
its own independent quota -- an attacker can multiply allowed volume by spreading
traffic across instances.

Multi-instance production deployments must either:
1. Set `EDGE_RATE_LIMIT_ENFORCED=true` and configure an edge gateway (e.g. nginx,
   Cloudflare, AWS WAF) to enforce shared limits before traffic reaches API instances.
2. Set `RATE_LIMIT_STORE=redis` and `RATE_LIMIT_REDIS_URL=<redis-url>` so API
   instances use the built-in Redis fixed-window store.
3. Set `RATE_LIMIT_EXTERNAL_ENFORCED=true` with a named `RATE_LIMIT_STORE` when
   another shared limiter is enforced outside the API process.

The Redis store uses atomic `INCR` plus `PEXPIRE` in a Lua script and fails
closed with `RESOURCE_EXHAUSTED` if the store is unavailable. Use Redis ACLs,
TLS where available, and do not log `RATE_LIMIT_REDIS_URL`.

Redis variables:

- `RATE_LIMIT_STORE=redis`
- `RATE_LIMIT_REDIS_URL`
- `RATE_LIMIT_REDIS_KEY_PREFIX` (default `managecallai:rate-limit`)

## Topology Evaluation Function

The topology check logic is exported as a pure function from
`apps/api/src/security/rate-limit.ts` for unit testing:

```typescript
import { evaluateRateLimitTopology } from './security/rate-limit.js';
const findings = evaluateRateLimitTopology({ appEnv, instanceCount, externalEnforced, ... });
```

Tests are in `apps/api/src/security/rate-limit.test.ts`.

## Release Gate

Production promotion requires the check to pass in the target topology. Warnings
must be reviewed, but only blocking findings fail the release gate.
