# Production Soak Testing

Run a soak test on a runtime-capable staging or production-candidate
environment before production promotion.

```sh
pnpm production:soak
```

Required environment:

| Variable | Purpose |
|---|---|
| `API_BASE_URL` | API root URL, with or without `/api/v1` |
| `RUNTIME_API_TOKEN` | Runtime credential for ingest probes |
| `SOAK_TENANT_ID` | Dedicated test tenant UUID for synthetic call events |

Optional environment:

| Variable | Default |
|---|---|
| `SOAK_DURATION_SECONDS` | `60` |
| `SOAK_CONCURRENCY` | `4` |
| `SOAK_TARGET_RPS` | `10` |
| `SOAK_ARTIFACT_DIR` | `artifacts/production-soak` |

## What It Exercises

- `/health`
- `/api/v1/call-events/internal/ingest`

The script intentionally uses a dedicated synthetic tenant. Do not run it
against a real customer tenant.

## Evidence

The command writes:

```text
artifacts/production-soak/production-soak-<timestamp>.json
```

Production release candidates must attach the evidence and record:

- API image tag
- instance count
- database size or class
- FreeSWITCH and agent versions if runtime traffic is connected
- configured rate-limit topology
- observed failure rate

The default threshold is a failure rate of 1% or lower.
