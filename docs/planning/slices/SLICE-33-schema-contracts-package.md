# SLICE-33 Schema Contracts Package

## Goal

Create a `packages/contracts` workspace package that is the single source of truth
for all API-facing request/response types. Generate the OpenAPI spec from code so
manual spec maintenance is eliminated. Give the web app machine-generated TypeScript
types derived from the spec.

## Status

**PLANNED**

## Context

The project currently has three independent representations of the same shape:

| Layer | What exists today | Problem |
|-------|-------------------|---------|
| API types | Manual `*.types.ts` interfaces per module | Drift from spec |
| Fastify validators | Inline JSON Schema strings per controller | Not shared, not typed |
| OpenAPI spec | Manually edited `docs/api/openapi.yaml` | Drift from code |
| Web app | No generated types — raw `fetch()` calls | No type safety |

Any field added or renamed must be updated in up to four places independently.
A CI gate that regenerates the spec and fails on drift closes this loop.

## Approach

```
packages/contracts/src/schemas/*.ts   ← Zod schemas (single source)
       │ z.infer<>                           │ @asteasolutions/zod-to-openapi
       ▼                                     ▼
API module *.types.ts              scripts/generate-openapi.mjs
(re-export from contracts)                   │
       │                                     ▼
Fastify controller                  docs/api/openapi.yaml (generated)
(body schema still JSON for now)             │
                                             ▼ openapi-typescript
                                    apps/web/src/api/types.gen.ts
```

The Fastify body validator upgrade (switch from inline JSON Schema to
`@fastify/type-provider-zod`) is deferred to SLICE-34. This slice delivers
the type contracts and the code-generation pipeline.

## Scope

- Create `packages/contracts` ES-module package with Zod + `@asteasolutions/zod-to-openapi`
- Define Zod schemas for every API-facing request/response type across all 25+ modules
- Register all component schemas and all paths in an OpenAPIRegistry
- Write `scripts/generate-openapi.mjs` → produces `docs/api/openapi.yaml`
- Write `scripts/generate-web-types.mjs` → runs `openapi-typescript` for the web
- Update API module `*.types.ts` to re-export from `@managecallai/contracts`
  (no duplicate interface declarations)
- Update CI: generate → diff → fail if spec is stale (or regenerate and commit)
- Update `check-openapi-coverage.mjs` to continue working on generated spec
- Add `@managecallai/contracts` dependency to `apps/api` and `apps/web`

## Does Not Change

- Fastify body validation (stays inline JSON Schema until SLICE-34)
- Controller logic, service layer, repository layer
- Database schema and migrations
- FreeSWITCH agent (Go)

## Depends On

- `SLICE-32` (adds channel + meeting types that must be included)
- `ADR-0010` (error standard shapes the ErrorResponse schema)

## Unblocks

- SLICE-34 (Fastify Zod type provider — uses contracts directly as validators)
- Type-safe web API client (derives from generated openapi-typescript output)
- Contract-driven mock server for integration tests
- Future SDK generation from OpenAPI

## Exit Criteria

- `pnpm --filter @managecallai/contracts build` succeeds
- `node scripts/generate-openapi.mjs` produces a spec that passes
  `check-openapi-coverage.mjs`
- The committed `docs/api/openapi.yaml` is the output of the generator
  (no manual content remains)
- `node scripts/generate-web-types.mjs` produces `apps/web/src/api/types.gen.ts`
  without error
- CI runs generate → verify on every push; a schema change without a spec
  regeneration causes CI to fail
- All `*.types.ts` files that previously declared duplicate interfaces now
  re-export from `@managecallai/contracts`

## Out Of Scope

- Switching Fastify body validation to Zod type provider (SLICE-34)
- SDK packaging or publishing to npm
- Generating mock servers or test fixtures
- Runtime Zod `.parse()` in controllers (type-level only in this slice)
