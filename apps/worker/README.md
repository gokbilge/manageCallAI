# worker

n8n-facing webhook handler service for `manageCallAI`.

## Current Webhooks

- `POST /webhooks/n8n/extensions/create`
- `POST /webhooks/n8n/call-events/list`

## Environment

- `API_BASE_URL`
- `WORKER_PORT`

## Run

```bash
pnpm --filter @managecallai/worker dev
```
