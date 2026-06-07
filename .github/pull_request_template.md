## Summary

<!-- What changed and why. One paragraph max. Link the related issue if one exists. -->

Closes #

## Type

- [ ] `feat` - new capability
- [ ] `fix` - bug correction
- [ ] `chore` - tooling, deps, configuration
- [ ] `docs` - documentation only
- [ ] `refactor` - no behavior change

## Contracts checklist

> Skip sections that do not apply.

- [ ] `packages/contracts` schema changed -> ran `pnpm --filter @managecallai/contracts build && node scripts/generate-openapi.mjs` and committed `docs/api/openapi.yaml`
- [ ] SDK regenerated -> `pnpm --filter @managecallai/sdk generate` and committed `packages/sdk/src/generated/schema.ts`
- [ ] MCP tool `inputSchema` updated - `scripts/check-mcp-schemas.mjs` passes locally
- [ ] New webhook event added -> payload schema in `WEBHOOK_PAYLOAD_SCHEMAS` - `scripts/check-webhook-payloads.mjs` passes locally
- [ ] New API key capability -> `API_KEY_CAPABILITIES` updated - `scripts/check-api-key-capabilities.mjs` passes locally

## Database checklist

- [ ] New migration: `db/migrations/NNNN_<name>.sql` (sequential, no gaps)
- [ ] Migration is safe to apply on a live database (additive only, or documented rollback)

## Test coverage

- [ ] Unit tests added or updated
- [ ] Integration tests added or updated
- [ ] All tests pass locally (`pnpm test`)

## Safety

- [ ] Dangerous state change (publish, rollback, outbound call) goes through approval + audit path
- [ ] No FreeSWITCH-internal terms (dialplan, sofia, ESL) in API-layer code or comments
- [ ] No secrets, tokens, or `.env` values committed
- [ ] Tenant isolation maintained for all new queries and routes

## Release impact

- [ ] No release impact
- [ ] Alpha blocker
- [ ] Beta blocker
- [ ] Production blocker
- [ ] Requires runtime evidence
- [ ] Requires migration evidence
- [ ] Requires security review
- [ ] Requires docs update

## Evidence

- CI:
- Runtime smoke:
- Restore:
- SLO/soak:
- Carrier:
- Security:

## Audit

- [ ] This change introduces an open finding -> linked issue: #
- [ ] No new open findings

## Planning and issue hygiene

- [ ] Linked umbrella and child issues still match the current design, roadmap, and documentation scope
