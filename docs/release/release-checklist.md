# Release Checklist

Use this checklist before promoting manageCallAI beyond development or staging.

## Required Gates

- `pnpm install --frozen-lockfile`
- `pnpm generate:openapi`
- `pnpm db:migrate`
- `pnpm db:contracts`
- `pnpm lint`
- `pnpm build`
- `pnpm test`
- `pnpm test:coverage`
- `pnpm check:migrations`
- `pnpm db:constraints`
- `pnpm check:mcp-schemas`
- `pnpm check:mcp-contracts`
- `pnpm check:webhook-payloads`
- `pnpm check:api-key-capabilities`
- `pnpm check:coverage-ignores`

## Coverage Gates

Phase 3 target thresholds:

- API: 88-90%
- Web: 80%
- MCP: 85%
- SDK: 90%
- FreeSWITCH agent: 85%

If the package has not reached the Phase 3 target yet, release readiness requires:

- no coverage decrease from the previous release candidate
- critical live-call-impacting paths covered by behavior tests
- a linked follow-up issue for each remaining high-risk gap
- no unapproved coverage ignore comments in critical safety paths

## E2E Gates

Normal CI should include an API-only demo loop covering tenant registration, extension creation, IVR validation/simulation/publish, runtime resolution, call event ingest, observability query, and rollback.

FreeSWITCH smoke tests may be optional when they require a self-hosted runner, but every release candidate must document whether the smoke was run and what runtime versions were used.

## Safety Review

Before release, verify:

- tenant isolation tests cover every tenant-scoped resource touched by the release
- API key wildcard behavior does not grant platform-admin capabilities
- MCP and n8n cannot invoke raw ESL, raw XML, shell, or direct runtime control
- outbound call policy changes include fraud-safety tests
- webhook signing and replay behavior remain covered
- logs and error responses do not expose runtime tokens, SIP secrets, webhook secrets, recordings, or stack traces in production mode
