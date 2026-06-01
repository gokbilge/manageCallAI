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

## Production Variables

- `MANAGECALLAI_INSTANCE_COUNT`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_AUTH_MAX`
- `RATE_LIMIT_RUNTIME_MAX`
- `RATE_LIMIT_WEBHOOK_MAX`
- `RATE_LIMIT_OUTBOUND_MAX`
- `RATE_LIMIT_EXTERNAL_ENFORCED`
- `RATE_LIMIT_STORE`
- `EDGE_RATE_LIMIT_ENFORCED`

## Release Gate

Production promotion requires the check to pass in the target topology. Warnings
must be reviewed, but only blocking findings fail the release gate.
