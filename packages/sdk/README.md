# @managecallai/sdk

OpenAPI-generated typed client foundation for the current `manageCallAI` MVP API surface.

This package generates TypeScript types directly from `docs/api/openapi.yaml` and wraps them with
`openapi-fetch` for a small typed client.

## Generation

```bash
pnpm --filter @managecallai/sdk run generate
```

Generated file:

- `src/generated/schema.ts`

## Covered Endpoints

- auth register / login
- list / create extensions
- list call events
- platform tenants
- platform runtime health

## Usage

```ts
import { ManageCallApiClient } from '@managecallai/sdk';

const client = new ManageCallApiClient({
  baseUrl: 'http://localhost:3000/api/v1',
});

const { token } = await client.login({
  tenant_slug: 'acme-demo',
  email: 'owner@acme-demo.local',
  password: 'Secret123!',
});

const extensions = await client.listExtensions({ accessToken: token });
```
