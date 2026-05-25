# worker

n8n-facing webhook handler service for `manageCallAI`.

## Current Webhooks

- `POST /webhooks/n8n/extensions/create`
- `POST /webhooks/n8n/call-events/list`

`/webhooks/n8n/extensions/create` and `/webhooks/n8n/call-events/list` must receive
an `Authorization: Bearer <jwt>` header and forward it to the control-plane API.

## Environment

- `API_BASE_URL`
- `WORKER_PORT`

## Run

```bash
pnpm --filter @managecallai/worker dev
```
