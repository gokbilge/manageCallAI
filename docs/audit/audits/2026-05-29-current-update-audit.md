# Audit - slice 33 completion - 2026-05-29

**Commit:** this commit
**Scope:** SLICE-33 contract package completion, generated OpenAPI/SDK type flow,
workspace lint, API Docker build dependency order, and related docs.
**Result:** PASS WITH FINDINGS

## Checks Run

- `pnpm build` - passed
- `pnpm lint` - passed
- `pnpm generate:openapi` - passed
- `pnpm generate:web-types` - passed
- `node scripts/check-openapi-coverage.mjs` - passed
- `pnpm test` - blocked locally because PostgreSQL was not reachable on port 5432
- `docker compose up -d postgres` - blocked locally because Docker Desktop was not running

## Findings

### AUD-2026-05-29-001: OpenAPI schema refs are stale after contract schema generation

- **Status:** done
- **Severity:** high
- **Location:** `scripts/generate-openapi.mjs`
- **Finding:** Historical path `$ref`s could point at legacy component names that no
  longer exist after generated contract schemas are emitted.
- **Fix:** The generator now normalizes legacy path `$ref`s to canonical component
  names and fails fast if any path `$ref` remains unresolved.
- **Resolved:** this commit

### AUD-2026-05-29-002: Contracts package lint script cannot run in workspace lint

- **Status:** done
- **Severity:** high
- **Location:** `packages/contracts/package.json`
- **Finding:** `@managecallai/contracts` had a lint script but no local ESLint
  dependency/config, causing `pnpm lint` to fail.
- **Fix:** Added package-local ESLint dependencies and `eslint.config.js`.
- **Resolved:** this commit

### AUD-2026-05-29-003: API Docker image cannot build with contracts imports

- **Status:** done
- **Severity:** high
- **Location:** `apps/api/Dockerfile`
- **Finding:** The API Docker build compiled `@managecallai/api` before the
  `@managecallai/contracts` workspace package it imports.
- **Fix:** Build `@managecallai/contracts` before `@managecallai/api` in the API
  Dockerfile.
- **Resolved:** this commit

### AUD-2026-05-29-004: Local integration test database unavailable

- **Status:** open
- **Severity:** low
- **Location:** local workstation
- **Finding:** API integration tests failed with `ECONNREFUSED 127.0.0.1:5432`
  because local PostgreSQL was not running. Attempting to start the repo's
  Postgres service failed because Docker Desktop was not available.
- **Fix:** Verify `pnpm test` in CI or on a machine with PostgreSQL/Docker running.
- **Resolved:**

## Notes

- `pnpm build` still emits the existing Vite chunk-size warning for the web bundle.
- `node scripts/check-openapi-coverage.mjs` found 97 operations with default error responses.
- Slice 32 was intentionally left unchanged.



