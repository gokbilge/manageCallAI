# Test Coverage Policy

manageCallAI coverage is risk-based. Coverage percentage is a release signal, not a substitute for telecom control-plane behavior tests.

## Baseline And Targets

| Package | Known baseline | Phase 1 target | Phase 2 target | Phase 3 target |
| --- | ---: | ---: | ---: | ---: |
| API | 67% | 75% | 82-85% | 88-90% |
| Web | 49% | 60% | 70-75% | 80% |
| MCP | 53% | 65% | 75-80% | 85% |
| SDK | 69% | 75% | 85% | 90% |
| FreeSWITCH agent | 51% | 65% | 75-80% | 85% |

Current measured coverage must be taken from CI artifacts for the exact commit under review. Do not raise hard thresholds above measured coverage.

## PR Policy

- Security and CodeQL remediation PRs may merge when coverage does not decrease and the security fix is tested where practical.
- Feature PRs must add behavior tests for new behavior.
- Refactor PRs must preserve or improve tests around touched code.
- Critical modules require stronger coverage than generic UI helpers.
- Diff coverage should be reviewed for touched critical paths even when package coverage passes.

## Critical-Path Requirements

Any code path that can change live call behavior must be:

- tenant-scoped
- capability-gated
- validated
- simulated where applicable
- audited where relevant
- idempotent where automation or AI retries may occur
- reversible where it changes published routing
- covered by behavior, integration, contract, runtime smoke, or E2E tests

## Meaningful Tests

Preferred tests:

- Fastify inject tests for API auth, tenant isolation, lifecycle, runtime, webhooks, and observability.
- Contract tests for OpenAPI, SDK, MCP schemas, webhook payloads, and generated types.
- React Testing Library behavior tests for operator workflows, loading, empty, and error states.
- Go unit tests with `httptest` for ESL normalization and delivery behavior.
- API-only E2E tests for publish, runtime resolution, event ingestion, observability, and rollback.

Avoid shallow snapshot tests, tests that assert implementation details without behavior, and coverage ignores around safety paths.

## Coverage Ignore Governance

Coverage ignore comments are allowed only for generated files, unreachable defensive branches, platform-specific fallbacks tested elsewhere, and type-only glue that cannot execute.

Coverage ignores are not allowed in auth/RBAC, tenant isolation, publish/rollback, runtime XML, webhook signing, idempotency, MCP tool safety, or Go event delivery.

Run:

```sh
pnpm check:coverage-ignores
```

Document justified exceptions in `docs/development/coverage-ignore-exceptions.md`.

## Local Commands

```sh
pnpm test
pnpm test:coverage
pnpm coverage:api
pnpm coverage:web
pnpm coverage:mcp
pnpm coverage:sdk
pnpm coverage:freeswitch-agent
```

Additional release checks:

```sh
pnpm build
pnpm lint
pnpm generate:openapi
pnpm db:migrate
pnpm db:contracts
```

## Threshold Strategy

Set hard CI thresholds only after tests are added and coverage is measured:

1. Add meaningful tests for critical behavior.
2. Measure package coverage in CI.
3. Set threshold slightly below achieved coverage.
4. Create follow-up issues for Phase 3 gaps.
5. Never lower an existing threshold without an explicit release-risk note.

Target final Phase 3 thresholds are API 88%, Web 80%, MCP 85%, SDK 90%, and FreeSWITCH agent 85%.
