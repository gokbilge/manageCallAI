# API Documentation

This directory is reserved for more detailed API documentation derived from the top-level REST API contract.

Current files:

- [openapi.yaml](openapi.yaml)
- [examples.md](examples.md)
- [rest-api.md](rest-api.md)

Contract generation:

- `packages/contracts/src/schemas/*.ts` defines API-facing Zod schemas.
- `pnpm generate:openapi` regenerates `docs/api/openapi.yaml`.
- `pnpm generate:web-types` regenerates `packages/sdk/src/generated/schema.ts`.
- CI fails when the generated OpenAPI document is stale.
