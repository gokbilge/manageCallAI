# Runtime SLO Gate

Runtime lookup endpoints are part of the live call path. Production release
candidates must attach latency evidence and pass:

```sh
pnpm production:slo-check -- --evidence=artifacts/release/runtime-slo.json
```

## Evidence Format

```json
{
  "generated_at": "2026-06-01T00:00:00Z",
  "environment": "staging-prod-candidate",
  "endpoints": [
    { "path": "/api/v1/freeswitch/directory", "sample_count": 1000, "p95_ms": 35, "p99_ms": 48 },
    { "path": "/api/v1/freeswitch/dialplan", "sample_count": 1000, "p95_ms": 70, "p99_ms": 95 },
    { "path": "/health/ready", "sample_count": 1000, "p95_ms": 12, "p99_ms": 18 }
  ]
}
```

## Thresholds

| Endpoint | Target p99 | Breach threshold |
|---|---:|---:|
| `/api/v1/freeswitch/directory` | 50 ms | 200 ms |
| `/api/v1/freeswitch/dialplan` | 100 ms | 500 ms |
| `/health/ready` | 20 ms | 100 ms |

Values above target emit warnings. Values above breach thresholds block
production promotion.

Do not include bearer tokens, SIP secrets, customer phone numbers, recordings,
or raw CDR payloads in the evidence file.
