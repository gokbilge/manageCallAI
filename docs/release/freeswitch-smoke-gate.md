# FreeSWITCH Smoke Release Gate

The FreeSWITCH smoke gate is the required runtime proof for public beta and
production release candidates.

## Repository Ruleset

The `Release and RC smoke gate` ruleset is active on this repository and targets:

- `refs/heads/release/**`
- `refs/heads/rc/**`

It requires the `FreeSWITCH runtime smoke` status check to pass before any push
or PR targeting those branches is accepted. The ruleset is visible at:

```
https://github.com/gokbilge/manageCallAI/rules
```

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

## Capturing Evidence For The Release Bundle

After the smoke workflow passes on an RC or release branch:

1. Retrieve the run URL:
   ```sh
   gh run list --workflow=freeswitch-smoke.yml --branch=rc/<version> --json url --jq '.[0].url'
   ```
2. Download the uploaded `freeswitch-smoke-<run_id>` artifact from the run.
3. Add the run URL to `freeswitch_smoke_run_url` in the release evidence manifest.
4. Add the E2E evidence path to `artifact_files.freeswitch_smoke_evidence`.

See `docs/release/release-evidence-bundle.md` for the manifest format.

## Infrastructure Requirement

This gate requires a self-hosted runner registered with labels `[self-hosted, freeswitch]`.
Until that runner is provisioned, `release/**` and `rc/**` branches will be blocked by the
pending smoke check. Document the missing runner as a release blocker; do not disable or
bypass the ruleset.

## Local Equivalent

For local runtime proof before pushing a release branch:

```sh
pnpm runtime:up
pnpm runtime:smoke
pnpm production:e2e
```

Local evidence does not replace the required release/RC branch status check.
