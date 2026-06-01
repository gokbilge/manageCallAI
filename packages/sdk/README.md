# @managecallai/sdk

Typed TypeScript client for the [manageCallAI](https://github.com/gokbilge/manageCallAI) REST API.

Types are generated from `docs/api/openapi.yaml` using
[openapi-typescript](https://github.com/openapi-ts/openapi-typescript) and wrapped
with [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) for a minimal, fully-typed client.

## Installation

```bash
# From GitHub Packages (@managecallai scope)
npm install @managecallai/sdk
# or
pnpm add @managecallai/sdk
```

The package requires Node.js 18+ or any modern browser / runtime with the
Fetch API available.

> **Note:** The package is published to GitHub Packages, not the public npm registry.
> You need a `.npmrc` with `@managecallai:registry=https://npm.pkg.github.com`.

## Quick start

```ts
import { ManageCallApiClient } from '@managecallai/sdk';

const client = new ManageCallApiClient({
  baseUrl: 'https://your-managecallai-instance/api/v1',
});

// Authenticate
const { token } = await client.login({
  tenant_slug: 'acme',
  email: 'admin@acme.example',
  password: 'secret',
});

// Create an extension
const ext = await client.createExtension(
  { extension_number: '200', display_name: 'Reception', sip_username: '200', sip_password: 'sip-secret' },
  { accessToken: token },
);

// Create, validate, simulate, and publish an IVR flow
const flow = await client.createIvrFlow(
  { name: 'Main IVR', graph_json: { entry_node_id: 'start', nodes: [{ id: 'start', type: 'hangup' }] } },
  { accessToken: token },
);
await client.validateIvrFlow(flow.id, { accessToken: token });
await client.simulateIvrFlow(flow.id, {}, { accessToken: token });
await client.publishIvrFlowVersion(flow.id, flow.draft_version_id!, { accessToken: token });
```

## Error handling

All methods throw `ManageCallApiError` on non-2xx responses.

```ts
import { ManageCallApiClient, ManageCallApiError } from '@managecallai/sdk';

try {
  await client.listExtensions({ accessToken: 'bad-token' });
} catch (err) {
  if (err instanceof ManageCallApiError) {
    console.error(err.message, err.status); // e.g. "UNAUTHENTICATED", 401
  }
}
```

## Idempotency

Pass `requestId` to ensure safe retries on mutations:

```ts
await client.createExtension(
  { extension_number: '201', display_name: 'Support', sip_username: '201', sip_password: 'sip-secret' },
  { accessToken: token, requestId: 'my-idempotency-key' },
);
```

## Covered endpoints

| Method | HTTP | Path |
|---|---|---|
| `register` | POST | `/auth/register` |
| `login` | POST | `/auth/login` |
| `listExtensions` | GET | `/extensions` |
| `createExtension` | POST | `/extensions` |
| `listPhoneNumbers` | GET | `/phone-numbers` |
| `listInboundRoutes` | GET | `/inbound-routes` |
| `listIvrFlows` | GET | `/ivr-flows` |
| `getIvrFlow` | GET | `/ivr-flows/{flowId}` |
| `createIvrFlow` | POST | `/ivr-flows` |
| `validateIvrFlow` | POST | `/ivr-flows/{flowId}/validate` |
| `simulateIvrFlow` | POST | `/ivr-flows/{flowId}/simulate` |
| `publishIvrFlowVersion` | POST | `/ivr-flows/{flowId}/versions/{versionId}/publish` |
| `rollbackIvrFlow` | POST | `/ivr-flows/{flowId}/rollback` |
| `listRecordings` | GET | `/recordings` |
| `getRuntimeSessionReplay` | GET | `/runtime/ivr/sessions/{sessionId}` |
| `listCallEvents` | GET | `/call-events` |
| `listPlatformTenants` | GET | `/platform/tenants` |
| `getPlatformRuntimeHealth` | GET | `/platform/runtime/health` |

The remaining 81 API operations (queues, voicemail, webhooks, schedules, approvals,
audit, etc.) are available via the generated `paths` type and the underlying
`openapi-fetch` client if you need them before they are wrapped.

## Using the raw typed client

```ts
import createClient from 'openapi-fetch';
import type { paths } from '@managecallai/sdk';

const raw = createClient<paths>({ baseUrl: 'https://...' });
const { data } = await raw.GET('/queues', {
  headers: { Authorization: `Bearer ${token}` },
});
```

## Generation

To regenerate types from a local OpenAPI spec:

```bash
pnpm --filter @managecallai/sdk run generate
```

This reads `docs/api/openapi.yaml` and writes `src/generated/schema.ts`.

## TypeScript

The package ships `.d.ts` declarations for all exports.
Requires TypeScript 4.7+ with `"moduleResolution": "bundler"` or `"node16"`.
