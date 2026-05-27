# Capability Model

## Overview

Authorization is role-based. Every JWT carries a `role` claim. The API maps roles to a fixed capability set; middleware enforces the required capability per route.

## Roles

| Role | Description |
|------|-------------|
| `platform_admin` | Anthropic/operator-level access. Set at login time when the email is in `PLATFORM_OPERATOR_EMAILS`. |
| `tenant_admin` | Default role for all tenant users. |

## Capabilities

| Capability | platform_admin | tenant_admin |
|-----------|:--------------:|:------------:|
| `platform.tenants.view` | ✓ | — |
| `platform.runtime.view` | ✓ | — |
| `platform.audit.view` | ✓ | — |
| `tenant.dashboard.view` | ✓ | ✓ |
| `tenant.extensions.view` | ✓ | ✓ |
| `tenant.extensions.create` | ✓ | ✓ |
| `tenant.extensions.update` | ✓ | ✓ |
| `tenant.extensions.deactivate` | ✓ | ✓ |
| `tenant.calls.view` | ✓ | ✓ |
| `tenant.directory_smoke_test.run` | ✓ | ✓ |

## How role is assigned

At `/auth/register` and `/auth/login` the API checks whether the authenticating email appears in `PLATFORM_OPERATOR_EMAILS` (comma-separated env var). If it does, `role = platform_admin`; otherwise `role = tenant_admin`. The role is embedded in the signed JWT and never stored in the database.

## Backend enforcement

`requireCapability(capability)` in `apps/api/src/modules/auth/require-capability.ts` is a Fastify `preHandler` factory. It verifies the JWT and checks `hasCapability(user.role, capability)`. A missing or unrecognized role falls back to `tenant_admin` so that existing tokens without a role claim continue to work.

Apply it per-route, not globally:

```typescript
app.post('/', { preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_CREATE) }, handler);
```

## Frontend enforcement

`RequireCapability` in `apps/web/src/lib/auth/require-capability.tsx` is a React Router `<Outlet>` wrapper that redirects to `/auth` (or a custom path) when the session lacks the required capability. It is composed in the router, not inside individual page components.

The sidebar derives visible nav items from `hasCapability(role, capability)` so unauthorized routes are never shown, but the guard in the router is the authoritative check.

## Backward compatibility

`hasCapability(undefined, capability)` defaults `role` to `tenant_admin`. This means sessions that predate the role claim still resolve correctly without requiring a re-login.
