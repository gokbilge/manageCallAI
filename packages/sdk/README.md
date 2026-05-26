# @managecallai/sdk

Minimal typed client for the current `manageCallAI` MVP API surface.

This package is intentionally hand-written for now. It should be replaced or regenerated from
`docs/api/openapi.yaml` once the API contract stabilizes further.

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
