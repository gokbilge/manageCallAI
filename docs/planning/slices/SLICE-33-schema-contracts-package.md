# SLICE-33 Schema Contracts Package

## Goal

Create a `packages/contracts` workspace package that is the single source of truth
for API-facing request/response schemas. Generate the OpenAPI spec from those
schemas so manual spec maintenance is minimized, and derive TypeScript SDK types
from the generated spec.

## Status

**IMPLEMENTED**

## Context

The project previously had several independent representations of the same API
shape:

| Layer | What exists now | Outcome |
|-------|-----------------|---------|
| API contract schemas | Zod schemas in `packages/contracts` | Shared source for route input and OpenAPI components |
| API controllers | Import schemas from `@managecallai/contracts` where migrated | Less duplicate request validation shape |
| OpenAPI spec | Generated `docs/api/openapi.yaml` | Drift checked in CI |
| SDK / clients | Generated `packages/sdk/src/generated/schema.ts` | TypeScript clients derive types from the spec |

Any field added or renamed should flow through the contracts package and generator
instead of being maintained independently in each surface.

## Approach

```text
packages/contracts/src/schemas/*.ts <- Zod schemas
        |                                  |
        | z.infer<>                        | @asteasolutions/zod-to-openapi
        v                                  v
API controllers                 scripts/generate-openapi.mjs
                                            |
                                            v
                                 docs/api/openapi.yaml
                                            |
                                            v openapi-typescript
                                 packages/sdk/src/generated/schema.ts
```

The generator preserves the existing path tree while replacing legacy path `$ref`
names with canonical generated component names. It fails fast if any path `$ref`
does not resolve.

## Scope

- Create `packages/contracts` ES-module package with Zod and `@asteasolutions/zod-to-openapi`
- Define Zod schemas for API-facing request/response types across the implemented modules
- Register component schemas in an OpenAPI registry
- Write `scripts/generate-openapi.mjs` to produce `docs/api/openapi.yaml`
- Write `scripts/generate-web-types.mjs` to run `openapi-typescript` through `packages/sdk`
- Update API controllers and type imports to consume `@managecallai/contracts`
- Update CI to generate, diff, and fail if the committed spec is stale
- Update `check-openapi-coverage.mjs` to continue working on the generated spec
- Ensure Docker image builds compile contracts before apps that import them

## Does Not Change

- Service layer and repository business logic
- Database schema and migrations
- FreeSWITCH agent (Go)
- Provider execution implementations

## Depends On

- `SLICE-32` (adds channel and meeting types that must be included)
- `ADR-0010` (error standard shapes the `ErrorResponse` schema)

## Unblocks

- SLICE-34 (broader Fastify Zod type-provider cleanup)
- Type-safe SDK/client usage from generated OpenAPI types
- Contract-driven mock server for integration tests
- Future SDK packaging and publishing

## Exit Criteria

- `pnpm --filter @managecallai/contracts build` succeeds
- `pnpm --filter @managecallai/contracts lint` succeeds
- `node scripts/generate-openapi.mjs` produces a spec that passes
  `check-openapi-coverage.mjs`
- The committed `docs/api/openapi.yaml` is the output of the generator
- `node scripts/generate-web-types.mjs` produces `packages/sdk/src/generated/schema.ts`
  without error
- CI runs generate and verify on every push; a schema change without a spec
  regeneration causes CI to fail
- API Docker image builds `@managecallai/contracts` before `@managecallai/api`

## Completion Notes

- `packages/contracts` now has its own ESLint dependencies and flat config.
- `scripts/generate-openapi.mjs` reports unresolved component refs before writing
  a spec.
- `packages/sdk` generates TypeScript types from `docs/api/openapi.yaml`.
- `apps/api/Dockerfile` builds contracts first so workspace imports resolve inside
  Docker.
- Slice 32 remains unchanged by this completion pass.

## Out Of Scope

- SDK packaging or publishing to npm
- Generating mock servers or test fixtures
- Concrete AI, transcription, text-to-speech, messaging, or meeting providers
