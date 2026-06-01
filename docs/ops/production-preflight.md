# Production Preflight

Run preflight before first production deploy, before each release candidate, and
after restoring production from backup.

```sh
pnpm production:preflight
```

The command validates environment-level safety. It does not replace a security
review, but it catches the defaults and omissions that most often lead to an
unsafe telecom deployment.

## Blocking Checks

- `APP_ENV` must be `production`.
- `DATABASE_URL`, `JWT_SECRET`, `RUNTIME_API_TOKEN`,
  `SIP_SECRET_MASTER_KEY`, and `SIP_SECRET_KEY_ID` must be present.
- `JWT_SECRET` and `RUNTIME_API_TOKEN` must be at least 32 characters.
- `SIP_SECRET_MASTER_KEY` must be 64 hex characters.
- Known sample values such as CI/test runtime tokens are rejected.
- FreeSWITCH ESL password must not be the stock default.

## Warnings

Warnings do not fail the command, but they should be resolved before live
traffic:

- `DATABASE_URL` points at localhost.
- `PLATFORM_OPERATOR_EMAILS` is missing.
- explicit production rate-limit values are missing.
- `RECORDING_STORAGE_ROOT` is missing.

## Network Boundary

Production deployments must keep these surfaces private or tightly allowlisted:

- `/api/v1/freeswitch/*`
- `/api/v1/runtime/*`
- Go agent callback paths
- PostgreSQL
- FreeSWITCH ESL

Use a reverse proxy, private network, or API gateway to enforce TLS, source IP
allowlists for FreeSWITCH nodes, request size limits, and access-log redaction
for `Authorization`, `x-managecallai-runtime-token`, runtime token query
fallbacks, webhook signatures, and SIP credentials.

## Source Of Truth

Design and architecture docs define product intent and runtime boundaries.
OpenAPI, contracts, migrations, and generated artifacts must follow those docs.
When behavior changes production runtime semantics, update the design or
architecture doc first, then update contracts, API implementation, tests, and
runtime artifacts.
