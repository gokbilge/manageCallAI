# Production Runtime E2E Gate

This is the production release gate for the live telecom runtime path. It is
stricter than the normal API demo loop because it is intended to run against a
real deployment or a self-hosted FreeSWITCH smoke runner.

## Command

```sh
pnpm production:e2e
```

Required environment:

| Variable | Purpose |
|---|---|
| `API_BASE_URL` | Root API URL, with or without `/api/v1` |
| `RUNTIME_API_TOKEN` | Runtime credential used by FreeSWITCH and the Go agent |
| `PRODUCTION_E2E_ARTIFACT_DIR` | Optional evidence directory. Defaults to `artifacts/production-e2e` |

## What It Proves

The gate performs one release journey:

1. API health responds.
2. A tenant and admin can be registered.
3. An extension can be created without leaking the SIP password in the JSON
   response.
4. The FreeSWITCH directory endpoint returns extension XML through runtime auth.
5. A prompt asset and IVR draft can be created.
6. The IVR draft validates and simulates to the expected extension.
7. The IVR version can be published or moved into the expected approval state.
8. A DID and inbound route can be created, validated, and published.
9. The FreeSWITCH dialplan endpoint resolves the DID to the published IVR flow.
10. The runtime IVR session endpoint starts a session for the active flow.
11. Runtime call-event ingest accepts the event for the tenant.
12. The tenant can query the ingested call event.

## Evidence

Each run writes sanitized JSON evidence to:

```text
artifacts/production-e2e/production-runtime-e2e-<timestamp>.json
```

The evidence includes step status and generated resource IDs. It must not include
JWTs, runtime tokens, SIP passwords, webhook secrets, or database credentials.
Smoke logs should be piped through:

```sh
node scripts/redact-logs.mjs
```

## Release Requirement

For a production release candidate, attach one of:

- a passing `FreeSWITCH Smoke` workflow artifact from the self-hosted runner, or
- a manual `pnpm production:e2e` evidence file plus runtime versions:
  PostgreSQL, Node.js, API image tag, FreeSWITCH version, Go agent commit, and
  operating system.

If the gate cannot run, the release is not production-ready. Document the reason
as a release blocker, not as an accepted limitation.
