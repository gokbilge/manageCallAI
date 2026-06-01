# Log Redaction

manageCallAI redacts sensitive values from logs, error responses, and support
bundles at two layers:

1. **URL redaction** — `redactSensitiveUrl` in `apps/api/src/logging/logger.ts`
   strips secret query parameters from logged request URLs at the Fastify layer.

2. **Text redaction** — `redact()` in `scripts/redact-logs.mjs` applies regex
   rules to sanitize log lines in support bundles and exported log files.

Run the coverage check at any time:

```sh
pnpm check:log-redaction
```

## Redacted Patterns

| Pattern type | Example | Redacted output |
|---|---|---|
| JWT Bearer token | `Authorization: Bearer eyJhb...` | `Authorization: Bearer [REDACTED]` |
| Runtime token header | `X-ManageCallAI-Runtime-Token: abc123` | `X-ManageCallAI-Runtime-Token: [REDACTED]` |
| Env var secrets | `JWT_SECRET=my-secret` | `JWT_SECRET=[REDACTED]` |
| Query param secrets | `?runtime_token=abc&call_id=1` | `?runtime_token=[REDACTED]&call_id=1` |
| JSON secret fields | `"password":"abc"` | `"password":"[REDACTED]"` |
| Database URL credentials | `postgres://user:pass@host/db` | `postgres://user:[REDACTED]@host/db` |
| Authorization header (raw) | `authorization: Bearer secret` | `authorization: Bearer [REDACTED]` |
| SIP password | `"sip_password":"abc"` | `"sip_password":"[REDACTED]"` |
| Cookie header | `cookie: session=abc` | `cookie: [REDACTED]` |
| Webhook signing secret | `WEBHOOK_SIGNING_SECRET=xyz` | `WEBHOOK_SIGNING_SECRET=[REDACTED]` |
| Automation API key | `mcak_abc123...` | `[REDACTED]` |

## What Is Not Logged

The following are never written to logs under any conditions:

- Raw runtime tokens (`RUNTIME_API_TOKEN`, `RUNTIME_API_TOKEN_SECONDARY`)
- SIP master key (`SIP_SECRET_MASTER_KEY`)
- JWT signing key (`JWT_SECRET`)
- ESL password (`FREESWITCH_ESL_PASSWORD`)
- Webhook signing secrets
- Automation API key values (only IDs are logged)
- Database URL passwords
- Recording file paths containing customer identifiers
- Voicemail paths
- Stack traces in production mode (`APP_ENV=production`)

## Production Error Responses

In production mode, error responses do not include stack traces or internal
error messages. The API returns a generic error body:

```json
{ "error": "Internal Server Error" }
```

Stack traces are written to the application log only. They are subject to URL
and text redaction at the log pipeline level.

## Support Bundle Redaction

When producing a support bundle, pipe log output through the redact filter:

```sh
# Redact a log file before sharing
node scripts/redact-logs.mjs < application.log > application.log.redacted

# Redact from a live process output
docker logs managecallai-api | node scripts/redact-logs.mjs > bundle.log
```

The redact script reads from stdin and writes to stdout. Chain it in any log
pipeline before log data leaves the deployment environment.

## Evidence Template

See `docs/ops/templates/log-redaction-evidence-template.json`. Validate a
filled evidence file with:

```sh
pnpm check:log-redaction -- --evidence=<path>
```

For beta and production gates, generate evidence from a real redacted log
bundle instead of hand-filling the template:

```sh
pnpm check:log-redaction -- \
  --scan-dir=artifacts/log-redaction/live-log-bundle \
  --output=artifacts/log-redaction/log-redaction-evidence-<timestamp>.json
```

The scan fails if API, runtime, FreeSWITCH, agent, or support-bundle logs still
contain raw authorization headers, runtime token headers, secret environment
variables, secret query parameters, JSON secret fields, or database URL
passwords.

## Related Documents

- `docs/ops/secret-rotation.md` — rotating secrets if a leak is suspected
- `docs/ops/network-hardening.md` — preventing token exposure via URL logs
