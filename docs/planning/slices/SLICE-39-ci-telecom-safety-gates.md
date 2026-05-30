# SLICE-39 CI Telecom Safety Gates

## Status

**IMPLEMENTED**

## Goal

Extend CI beyond compile/lint/unit tests into telecom-specific release gates that
catch unsafe runtime, schema, and deployment regressions.

## What was implemented

### .github/workflows/ci.yml

- **Secret scanning** (`scripts/check-secrets.mjs`): Checks all git-tracked files for
  known demo defaults (default JWT_SECRET, RUNTIME_API_TOKEN, ClueCon ESL password) and
  high-confidence secret patterns (private keys, AWS keys, GitHub tokens). Allowed paths
  documented in the script.

- **Full migration replay** (`pnpm db:migrate`): Applies all migrations against the fresh
  CI PostgreSQL service in file order. Fails if any migration has a SQL error.

- **Dependency vulnerability audit** (`pnpm audit --audit-level=high`): Fails on high or
  critical severity vulnerabilities. Exception process documented in
  `docs/security/audit-exceptions.md`.

- **MCP contract drift check** (`scripts/check-mcp-contracts.mjs`): Runs
  `apps/mcp` vitest suite including `tools/contract-drift.test.ts` which compares
  MCP tool inputSchemas to `packages/contracts` Zod schemas.

- **IVR simulation regression** (`scripts/check-ivr-simulation.mjs`): Runs IVR graph
  validation and simulation engine unit tests explicitly to catch regressions in
  call-flow logic.

- **Runtime XML golden-file tests** (via `pnpm test` and explicit vitest step):
  `apps/api/src/modules/freeswitch/dialplan-builders.test.ts` asserts that FreeSWITCH
  XML output matches expected content for IVR flows, call groups, and directory lookups.

- **Docker image build test** (new `docker-build` job): Builds Docker images for all
  runnable apps (`api`, `worker`, `mcp`, `mcp-server`, `freeswitch-agent`) on every PR
  without pushing. Added `apps/mcp/Dockerfile`; only mcp-server had one before.

- **FreeSWITCH profile smoke test**: Implemented in `scripts/check-freeswitch-profile.mjs`
  as a local-only script. Cannot run in standard CI because FreeSWITCH requires host
  network access for SIP/media. The CI workflow includes a commented placeholder that
  can be enabled on a self-hosted runner. The deterministic CI substitute is the
  dialplan golden-file test above.

### scripts/ additions

| Script | Purpose |
|--------|---------|
| `check-secrets.mjs` | Secret and demo-default scanning |
| `check-mcp-contracts.mjs` | Legacy MCP contract drift runner |
| `check-mcp-schemas.mjs` | Contract-derived MCP input schema drift checker |
| `check-webhook-payloads.mjs` | Webhook payload contract drift checker |
| `check-api-key-capabilities.mjs` | API-key capability contract drift checker |
| `check-ivr-simulation.mjs` | IVR simulation regression runner |
| `check-freeswitch-profile.mjs` | Local FreeSWITCH ESL smoke test |

## Out Of Scope

- Production load testing.
- Carrier-specific SIP interoperability certification.
- Full browser E2E coverage for every admin screen.

## Acceptance Criteria (met)

- CI fails on migration replay errors, MCP contract drift, secret leaks, and
  vulnerable dependency violations.
- FreeSWITCH profile smoke test runs locally and is documented with a CI placeholder.
- Runtime XML golden-file tests run in CI via the dialplan builders test step.
