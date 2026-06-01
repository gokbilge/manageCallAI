# FreeSWITCH Smoke Release Gate

The FreeSWITCH smoke gate is the required runtime proof for public beta and
production release candidates.

## Required Status Check

Configure branch protection or repository rulesets for these branch patterns:

- `release/**`
- `rc/**`

Required status check:

- `FreeSWITCH runtime smoke`

The check is produced by `.github/workflows/freeswitch-smoke.yml`. A pending,
skipped, cancelled, or failed check blocks release promotion.

## Runner Contract

The workflow runs on:

```text
[self-hosted, freeswitch]
```

The runner must provide:

- FreeSWITCH 1.10+ with `mod_xml_curl` pointed at the local API
- PostgreSQL reachable through `SMOKE_DATABASE_URL`
- API reachable at `SMOKE_API_URL` or the workflow `api_url` input
- SIP registrar on `127.0.0.1:5060`
- ESL on `127.0.0.1:8021`
- Go toolchain matching `go.work`

Required repository secrets:

- `SMOKE_DATABASE_URL`
- `SMOKE_JWT_SECRET`
- `SMOKE_RUNTIME_API_TOKEN`
- `SMOKE_SIP_SECRET_MASTER_KEY`
- `SMOKE_FREESWITCH_ESL_PASSWORD`

## What The Gate Proves

The workflow verifies:

- database migrations apply
- API health responds
- FreeSWITCH ESL profile is reachable
- production runtime E2E journey passes
- SIP REGISTER smoke passes
- Go agent ESL smoke passes
- smoke evidence is uploaded with secrets redacted

## Local Equivalent

For local runtime proof before pushing a release branch:

```sh
pnpm runtime:up
pnpm runtime:smoke
pnpm production:e2e
```

Local evidence does not replace the required release/RC branch status check.
