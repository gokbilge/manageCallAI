# @managecallai/web

MVP React application for the two `manageCallAI` operator workspaces:

- Platform Management
- Tenant Admin

## Scripts

```bash
pnpm --filter @managecallai/web dev
pnpm --filter @managecallai/web build
pnpm --filter @managecallai/web lint
pnpm --filter @managecallai/web test
```

## Current Scope

- workspace-aware routing
- shared enterprise shell
- placeholder platform and tenant pages
- token-based styling via Tailwind v4 theme variables
- Lucide-based navigation/iconography foundation

## Next Implementation Steps

- replace placeholder auth/session data with real API-backed session handling
- generate and wire the typed API client from OpenAPI
- add extension, calls, and runtime pages against the live backend
- add the visual flow builder workspace using React Flow
