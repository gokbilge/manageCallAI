# mcp-server

Read-only MCP server for `manageCallAI`.

## Current Tools

- `list_extensions`
- `get_extension`
- `list_call_events`

`list_extensions`, `get_extension`, and `list_call_events` require an `access_token`
argument because the control-plane API protects those endpoints with JWT auth.

## Environment

- `API_BASE_URL`

## Run

```bash
pnpm --filter @managecallai/mcp-server dev
```

The server uses stdio transport and calls the main API over HTTP.
