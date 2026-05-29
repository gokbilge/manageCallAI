# Audit - provider contract slices - 2026-05-29

**Commit:** this commit
**Scope:** SLICE-25, SLICE-26, SLICE-27, SLICE-28, and SLICE-31 implementation batch.
**Result:** PASS WITH FINDINGS

## Checks Run

- `pnpm --filter @managecallai/api test`
- `pnpm --filter @managecallai/api build`
- `pnpm db:migrate`
- `pnpm db:status`
- `pnpm lint`
- `pnpm build`
- `pnpm test`
- `pnpm --filter @managecallai/sdk exec openapi-typescript ../../docs/api/openapi.yaml -o ../../.runtime/openapi-check.ts`
- `pnpm --filter @managecallai/sdk run generate`
- `pnpm --filter @managecallai/api test -- provider-work.service.test.ts`
- `git diff --check`
- Grep: `SELECT *`, `RETURNING *`, `console.`, `TODO`, `FIXME`, `sip_password[^_]`

## Findings

### AUD-2026-05-29-001: Live runtime smoke still requires a running FreeSWITCH stack

- **Status:** accepted
- **Severity:** info
- **Location:** `scripts/live-runtime-smoke.ps1`
- **Finding:** The new smoke command automates the release path but still depends on the local runtime profile being up and configured with a valid tenant/runtime token before SIP registration can pass.
- **Fix:** Accepted for this slice because hosted synthetic monitoring and replacing runtime prerequisites are out of scope.
- **Resolved:** accepted

### AUD-2026-05-29-002: Provider execution is contract-only

- **Status:** accepted
- **Severity:** info
- **Location:** `apps/api/src/modules/provider-work/provider-work.controller.ts`
- **Finding:** Prompt generation, recording analysis, and IVR AI turn endpoints persist and expose provider-neutral work requests, claims, and results, but do not call OpenAI, ElevenLabs, Whisper, or another provider.
- **Fix:** Accepted by scope. Concrete provider adapters are future-version work and must use these contracts.
- **Resolved:** accepted

### AUD-2026-05-29-003: Existing SIP password grep hits are request-boundary and test usage

- **Status:** done
- **Severity:** info
- **Location:** `apps/api/src/modules/extensions/extension.service.ts`
- **Finding:** Audit grep found `sip_password` in tests, HTTP schemas, and the extension service encryption boundary. No new plaintext SIP password persistence or response exposure was introduced.
- **Fix:** No code change required.
- **Resolved:** this commit
