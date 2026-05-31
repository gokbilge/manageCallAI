# SLICE-49 Public Alpha Readiness And Security Triage

## Priority

P0 - public alpha gate

## Status

PLANNED

## Goal

Prepare the repository for an honest public alpha by closing or triaging active
security findings, documenting limitations, and proving the clean-clone demo path.

## Context

The core API domains, schema contracts, MCP/n8n surfaces, FreeSWITCH XML
foundation, and CI gates are strong enough for internal alpha. Public alpha needs
clear release positioning and no unresolved high/medium security surprises.

## Scope

- Close or triage all high/medium CodeQL findings.
- Verify global fallback rate limiting for normal authenticated `/api/v1/*`
  routes.
- Verify sensitive runtime/SIP logging is redacted in production paths.
- Update README and release docs to say alpha/not production-ready.
- Verify `docs/release/public-alpha-readiness.md` and
  `docs/deployment/local-alpha.md` from a clean clone.
- Add known limitations to release notes.
- Run the API demo loop and one runtime proof manually on a clean machine.

## Acceptance Criteria

- No untriaged high/medium CodeQL findings remain.
- Rate limiting and log redaction checks pass locally and in CI where practical.
- README links to alpha limitations and readiness docs.
- Clean-clone alpha verification is documented with exact commands and results.
- Public alpha can be tagged without implying production readiness.

## Suggested Claude Prompt

```text
You are a senior application security engineer, release manager, and telecom
runtime reviewer.

Repository:
https://github.com/gokbilge/manageCallAI

Task:
Complete SLICE-49: Public Alpha Readiness And Security Triage.

Goals:
- Prepare the project for an honest public alpha.
- Close or triage active high/medium CodeQL findings.
- Verify global fallback rate limiting for normal authenticated `/api/v1/*`
  routes.
- Verify sensitive runtime/SIP logging is redacted.
- Ensure README and release docs clearly say alpha and not production-ready.
- Verify the clean-clone local alpha path.

Required work:
1. Inspect GitHub code scanning alerts and local security docs.
2. Fix true-positive CodeQL findings.
3. Add or improve tests for rate limiting and log redaction where needed.
4. Update README, docs/release/public-alpha-readiness.md, and
   docs/deployment/local-alpha.md if they are incomplete or stale.
5. Run the public alpha gate commands:
   - pnpm install --frozen-lockfile
   - pnpm db:migrate
   - pnpm build
   - pnpm lint
   - pnpm test
   - pnpm test:coverage
   - pnpm generate:openapi
   - pnpm db:contracts
   - pnpm check:mcp-schemas
   - pnpm check:webhook-payloads
   - pnpm check:api-key-capabilities
6. Document any manual runtime proof that cannot run in GitHub-hosted CI.

Acceptance criteria:
- No untriaged high/medium security findings remain.
- Public alpha limitations are explicit.
- Clean-clone alpha setup is reproducible.
- CI passes.
- No production-ready claim is introduced.
```

