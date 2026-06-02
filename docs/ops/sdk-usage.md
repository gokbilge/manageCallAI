# SDK Usage and Versioning

The `@managecallai/sdk` package provides TypeScript types and a pre-configured HTTP client generated from the OpenAPI spec.

---

## Installation

```sh
npm install @managecallai/sdk
# or
pnpm add @managecallai/sdk
```

The SDK is published to the GitHub Packages npm registry. Configure `.npmrc`:

```
@managecallai:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<GITHUB_TOKEN>
```

---

## Quick Start

```ts
import createClient from 'openapi-fetch';
import type { paths } from '@managecallai/sdk';

const client = createClient<paths>({
  baseUrl: 'https://your-api.example.com',
  headers: {
    Authorization: `Bearer ${process.env.MANAGECALLAI_API_KEY}`,
  },
});

// List IVR flows
const { data, error } = await client.GET('/api/v1/ivr-flows', {});
if (error) throw new Error(JSON.stringify(error));
console.log(data.data); // typed as IvrFlow[]
```

---

## Authentication

All API endpoints require authentication via a JWT (from `POST /api/v1/auth/login`) or an API key (passed in `Authorization: Bearer`).

```ts
// Login and get a JWT
const { data: auth } = await client.POST('/api/v1/auth/login', {
  body: {
    tenant_slug: 'my-tenant',
    email: 'admin@example.com',
    password: 'Secret123!',
  },
});
const token = auth?.token;
```

---

## Type Reference

The SDK exports all request/response types from the OpenAPI spec. Key types:

```ts
import type {
  paths,
  components,
} from '@managecallai/sdk';

// Use component schemas directly
type IvrFlow = components['schemas']['IvrFlow'];
type Extension = components['schemas']['Extension'];
```

---

## Versioning Policy

| SDK version | API version | Notes |
|---|---|---|
| `0.1.x` | `v1` | Alpha — breaking changes possible between minor versions |
| `0.2.x` | `v1` | Beta — semver compatibility within minor |
| `1.x` | `v1` | Production — full semver compatibility |

The SDK version tracks the API version. Breaking API changes result in a new SDK minor (pre-1.0) or major (post-1.0) version.

**Pre-1.0 policy**: Minor versions may include breaking changes. Pin to a specific version in alpha/beta usage.

---

## SDK Publish Workflow

The SDK is published automatically via `.github/workflows/sdk-publish.yml` on version tags (`v*`). To verify the publish workflow before release:

```sh
# Dry-run from packages/sdk
cd packages/sdk
npm publish --dry-run
```

Confirm the output shows only the expected type files and no secrets or private assets.

---

## Regenerating the SDK

If you change the OpenAPI spec:

```sh
pnpm generate:openapi          # regenerate docs/api/openapi.yaml
pnpm --filter @managecallai/sdk generate  # regenerate SDK types
pnpm --filter @managecallai/sdk build     # compile
```

CI runs this as part of the OpenAPI drift check. SDK types must always match the generated OpenAPI spec.

---

## Related

- `packages/sdk/` — SDK source
- `docs/api/openapi.yaml` — OpenAPI spec (source of truth for SDK types)
- `.github/workflows/sdk-publish.yml` — SDK publish automation
- `pnpm generate:openapi` — Regenerate OpenAPI spec
