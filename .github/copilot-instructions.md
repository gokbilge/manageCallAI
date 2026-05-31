# Copilot Instructions

`manageCallAI` is a telecom configuration management platform. Review code with
the assumption that unsafe defaults, tenant leakage, or malformed runtime
configuration can create real operational and security risk.

## Repository Rules

- Use `pnpm` for all workspace commands.
- TypeScript uses strict mode, ES modules, and `NodeNext` resolution.
- Imports in TypeScript files must include `.js` extensions.
- Keep SQL inside repository classes and business logic inside service classes.
- Do not suggest committing `.env` files, real SIP credentials, JWT secrets,
  runtime tokens, recordings, or customer call data.
- FreeSWITCH is an external runtime. The API produces desired-state
  configuration and runtime XML; business rules should stay in TypeScript.
- Public API surfaces should use business domain vocabulary.

## Review Priorities

Flag issues involving:

- RBAC or capability checks that fail open.
- Tenant isolation gaps in SQL, services, controllers, tests, or MCP tools.
- Weak production secrets, secret logging, token exposure, or query/body token
  authentication on production paths.
- SIP credential handling, runtime token handling, webhook signing, MCP
  permissions, and AI-originated mutations.
- FreeSWITCH XML generation that is not validated, deterministic, or covered by
  golden tests.
- OpenAPI, Zod contract, MCP schema, and UI schema drift.
- Database migrations that are not replayable from an empty database.
- Missing indexes or constraints on runtime hot paths.
- Non-idempotent webhook, automation, AI mutation, or publish operations.
- IVR graph changes without validation, simulation coverage, diff visibility,
  rollback behavior, or runtime failure handling.

## Expected Feedback Style

- Prioritize concrete bugs, security risks, regressions, and missing tests.
- Include file and line references when possible.
- Prefer small, actionable fixes that match existing repository patterns.
- Do not suggest broad rewrites unless they are tied to a specific risk.
- Treat Copilot review as advisory; protected branches still require human
  review, passing CI, and CODEOWNERS approval.
