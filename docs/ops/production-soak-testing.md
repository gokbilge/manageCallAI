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
| `RUNTIME_API_TOKEN` | Runtime credential for lookup and ingest probes |

Optional environment:

| Variable | Default |
|---|---|
| `SOAK_DURATION_SECONDS` | `60` |
| `SOAK_CONCURRENCY` | `4` |
| `SOAK_TARGET_RPS` | `10` |
| `SOAK_ARTIFACT_DIR` | `artifacts/production-soak` |
| `PRODUCTION_SLO_OUTPUT` | `artifacts/release/runtime-slo.json` |
| `SOAK_TENANT_ID` | unset; script provisions a synthetic tenant |
| `SOAK_DIRECTORY_DOMAIN` | unset; required only when reusing an existing tenant |
| `SOAK_EXTENSION_NUMBER` | `1001` |
| `SOAK_DIALPLAN_DESTINATION` | unset; required only when reusing an existing tenant |

## What It Exercises

- `/health`
- `/health/ready`
- `/api/v1/freeswitch/directory`
- `/api/v1/freeswitch/dialplan`
- `/api/v1/call-events/internal/ingest`

When `SOAK_TENANT_ID`, `SOAK_DIRECTORY_DOMAIN`, and
`SOAK_DIALPLAN_DESTINATION` are not set, the script provisions a dedicated
synthetic tenant, extension, IVR flow, phone number, and inbound route before
sampling runtime lookups. Do not run it against a real customer tenant.

## Evidence

The command writes:

```text
artifacts/production-soak/production-soak-<timestamp>.json
artifacts/release/runtime-slo.json
```

Production release candidates must attach the evidence and record:

- API image tag
- instance count
- database size or class
- FreeSWITCH and agent versions if runtime traffic is connected
- configured rate-limit topology
- observed failure rate
- p95 and p99 latency for directory, dialplan, and readiness endpoints

The default threshold is a failure rate of 1% or lower. Validate the SLO
artifact with:

```sh
pnpm production:slo-check -- --evidence=artifacts/release/runtime-slo.json
```
