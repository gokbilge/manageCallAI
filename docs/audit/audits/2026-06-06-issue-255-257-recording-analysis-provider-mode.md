# Audit - issue-255-257-recording-analysis-provider-mode - 2026-06-06

**Commit:** PR head at merge
**Scope:** Provider-backed recording transcript and summary analysis policy, lifecycle visibility, and operator review surface for issues #255 and #257.
**Result:** PASS WITH FINDINGS

## Findings

### AUD-2026-06-06-001: Local DB-backed integration tests require external PostgreSQL

- **Status:** accepted
- **Severity:** info
- **Location:** `apps/api/src/modules/ai-policy/ai-policy.integration.test.ts`, `apps/api/src/modules/recordings/recording-summary.integration.test.ts`
- **Finding:** The DB-backed integration suite could not run in this workstation session because PostgreSQL was unavailable on `127.0.0.1:5432`. Unit tests, web tests, build, lint, OpenAPI generation, and SDK generation passed locally.
- **Fix:** Rely on GitHub Actions `build-test` and `coverage` for DB-backed verification before merge.
- **Resolved:** CI pending at commit time
