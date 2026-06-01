# Production Runtime E2E Gate

This is the required runtime smoke gate for public beta and production release
candidates. It proves the full telecom runtime path: API, PostgreSQL,
FreeSWITCH mod_xml_curl, SIP REGISTER, IVR lifecycle, Go ESL agent, and
call-event observability.

Passing this gate alone does not make the project production-ready. Production
still requires backup/restore evidence, carrier interop evidence, SLO/soak
evidence, fraud controls, and operator sign-off. See
`docs/release/release-checklist.md`.

## Running Locally

```bash
cp .env.example .env
# Edit .env — set non-sample values for all required variables
set -a && source .env && set +a
./scripts/local-runtime-release-gate.sh
```

Required ports (must be free before running):

| Port | Protocol | Service |
|---|---|---|
| 5432 | TCP | PostgreSQL |
| 3000 | TCP | API |
| 8021 | TCP | FreeSWITCH ESL |
| 5060 | UDP | SIP (external) |
| 5080 | TCP/UDP | SIP (internal) |

Required environment variables (set in `.env`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | API auth signing secret (≥32 chars) |
| `RUNTIME_API_TOKEN` | Runtime credential for FreeSWITCH and Go agent |
| `SIP_SECRET_MASTER_KEY` | 64-hex-char AES-256-GCM key for SIP password encryption |
| `SIP_SECRET_KEY_ID` | Key version identifier |
| `FREESWITCH_ESL_PASSWORD` | ESL password (defaults to ClueCon — change for non-dev) |
| `API_BASE_URL` | API root (default: http://localhost:3000) |

Evidence is written to:

```text
artifacts/production-e2e/production-runtime-e2e-<timestamp>.json
```

Clean up the stack after the gate:

```bash
pnpm runtime:down
```

Or pass `CLEANUP=true` to tear down automatically:

```bash
CLEANUP=true ./scripts/local-runtime-release-gate.sh
```

## Individual Commands

```sh
pnpm production:e2e
```

| Variable | Purpose |
|---|---|
| `API_BASE_URL` | Root API URL, with or without `/api/v1` |
| `RUNTIME_API_TOKEN` | Runtime credential used by FreeSWITCH and the Go agent |
| `PRODUCTION_E2E_ARTIFACT_DIR` | Optional evidence directory. Defaults to `artifacts/production-e2e` |

## What It Proves

The gate performs one complete release journey:

1. API health responds.
2. A tenant and admin can be registered.
3. An extension can be created without leaking the SIP password.
4. The FreeSWITCH directory endpoint returns extension XML through runtime auth.
5. A prompt asset and IVR draft can be created.
6. The IVR draft validates and simulates to the expected extension.
7. The IVR version can be published or moved into the expected approval state.
8. A DID and inbound route can be created, validated, and published.
9. The FreeSWITCH dialplan endpoint resolves the DID to the published IVR flow.
10. The runtime IVR session endpoint starts a session for the active flow.
11. Runtime call-event ingest accepts the event for the tenant.
12. The tenant can query the ingested call event.
13. The Go agent ESL connection smoke completes.

## Evidence

Each run writes sanitized JSON evidence to:

```text
artifacts/production-e2e/production-runtime-e2e-<timestamp>.json
```

Evidence must not include JWTs, runtime tokens, SIP passwords, webhook secrets,
or database credentials. Pipe output through:

```sh
node scripts/redact-logs.mjs
```

Validate the evidence artifact before using it in a release:

```sh
pnpm check:runtime-e2e-evidence -- --dir=artifacts/production-e2e
```

The validator requires `status: "passed"`, `mode: "live"`, and all 11 required
step names. It rejects `mode: "check-config"` evidence and artifacts that
contain patterns resembling unredacted secrets.

## GitHub Release Gate

For public beta and production release candidates, the `FreeSWITCH Smoke`
workflow must pass on the self-hosted runner. See
`docs/release/freeswitch-smoke-gate.md` for:

- runner requirements
- required GitHub secrets
- branch protection / ruleset setup
- evidence capture instructions

## Release Evidence Requirements

A release candidate must document:

| Item | Source |
|---|---|
| Workflow run URL | GitHub Actions run page |
| Artifact name | `freeswitch-smoke-<run_id>` |
| Commit SHA | `git_sha` in evidence JSON |
| FreeSWITCH version | `FREESWITCH_VERSION` in `.env` / workflow |
| Evidence JSON path | `artifacts/production-e2e/*.json` |
| SIP REGISTER result | Smoke step in workflow log |
| Go ESL smoke result | Smoke step in workflow log |
| Migration head | `pnpm db:status` output |
| Known limitations | See `docs/deployment/local-alpha.md` |

## Known Limitations

- This gate requires a self-hosted runner with real FreeSWITCH, SIP ports, and
  network access. It cannot run on GitHub-hosted runners.
- The gate is not a substitute for load testing, carrier interop, or
  backup/restore evidence.
- Public beta requires a passing gate. Production requires passing gate plus
  all remaining production checklist items.
