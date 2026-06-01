# Capability Model

## Overview

Authorization is role-based. Every JWT carries a `role` claim. The API maps roles to a
fixed capability set defined in `apps/api/src/modules/auth/capabilities.ts`; middleware
enforces the required capability per route.

## Roles

| Role | Storage | Description |
|------|---------|-------------|
| `tenant_admin` | `users.role` | Default role for the first user of every tenant (seeded at registration). Full tenant management. |
| `tenant_operator` | `users.role` | Create/update operations; cannot publish flows, deactivate entities, or manage automation keys. |
| `tenant_viewer` | `users.role` | Read-only access to all tenant resources. |
| `platform_admin` | JWT only (never persisted) | Full cross-tenant access. Computed at login/register time when the authenticating email appears in `PLATFORM_OPERATOR_EMAILS`. |

## Canonical role model

`users.role` is the **single source of truth** for tenant roles. The legacy `roles` and
`user_roles` tables created in the initial schema migration exist as design artifacts from
an earlier RBAC model and are **unused by the application**. They must not be read or
written by any production code path.

`platform_admin` is **never stored in the database**. It is computed in the auth
controller by checking `config.platformOperatorEmails` at login and registration time,
then issued as a JWT claim. Migration `0027_role_model_cleanup.sql` widens the DB
CHECK constraint to include `platform_admin` as a safety net only.

## How role is assigned

1. **Registration** (`POST /auth/register`): The repository explicitly inserts `role =
   'tenant_admin'`. The auth controller then overrides the JWT role to `platform_admin`
   if the email is in `PLATFORM_OPERATOR_EMAILS`.
2. **Login** (`POST /auth/login`): The service reads `users.role` from the database. The
   controller overrides to `platform_admin` if the email matches.
3. **User management** (`PATCH /users/:id`): Tenant admins may change a user's tenant
   role to any of the three tenant roles. Self-role-change is forbidden.

## Capabilities (condensed)

| Capability | platform_admin | tenant_admin | tenant_operator | tenant_viewer |
|-----------|:-:|:-:|:-:|:-:|
| `platform.tenants.view` | yes | no | no | no |
| `platform.runtime.view` | yes | no | no | no |
| `platform.audit.view` | yes | no | no | no |
| `tenant.dashboard.view` | yes | yes | yes | yes |
| `tenant.extensions.*` (view) | yes | yes | yes | yes |
| `tenant.extensions.*` (create/update) | yes | yes | yes | no |
| `tenant.extensions.deactivate` | yes | yes | no | no |
| `tenant.calls.view` | yes | yes | yes | yes |
| `tenant.inbound_routes.*` (view) | yes | yes | yes | yes |
| `tenant.inbound_routes.*` (create/update/activate) | yes | yes | yes | no |
| `tenant.inbound_routes.deactivate` | yes | yes | no | no |
| `tenant.ivr_flows.*` (view) | yes | yes | yes | yes |
| `tenant.ivr_flows.*` (create/update/validate/simulate) | yes | yes | yes | no |
| `tenant.ivr_flows.publish` / `rollback` | yes | yes | no | no |
| `tenant.approvals.view` | yes | yes | yes | yes |
| `tenant.approvals.decide` | yes | yes | no | no |
| `tenant.automation.keys.manage` | yes | yes | no | no |
| `tenant.automation.webhooks.manage` | yes | yes | no | no |
| `tenant.outbound_calls.create` | yes | yes | yes | no |
| `tenant.fraud_policy.view` | yes | yes | yes | no |
| `tenant.fraud_policy.manage` | yes | yes | no | no |
| `tenant.security.alerts.view` | yes | yes | yes | no |
| `tenant.security.alerts.manage` | yes | yes | no | no |
| `tenant.compliance.admin` | yes | yes | no | no |
| `tenant.audit_log.view` | yes | yes | yes | no |
| `tenant.users.manage` | yes | yes | no | no |

The authoritative capability-to-role mapping lives in `ROLE_CAPABILITIES` in
`apps/api/src/modules/auth/capabilities.ts`. This table is a summary; the code is the
source of truth.

## Backend enforcement

`requireCapability(capability)` in
`apps/api/src/modules/auth/require-capability.ts` is a Fastify `preHandler` factory.
It verifies the JWT (or API key) and checks `hasCapability(user.role, capability)`.

- A missing or unrecognized role is denied (`hasCapability` fails closed).
- API keys must resolve to a valid tenant/user with at least one active capability.

Apply it per-route:

```typescript
app.post('/', { preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_CREATE) }, handler);
```

## Frontend enforcement

`RequireCapability` in `apps/web/src/lib/auth/require-capability.tsx` wraps React
Router `<Outlet>` and redirects to `/auth` when the session lacks the required
capability. The sidebar derives visible nav items from `hasCapability(role, capability)`,
but the router guard is the authoritative check.

## Fail-closed behavior

`hasCapability(undefined, capability)` and unrecognized role strings return `false`.
Older sessions without a role claim must re-authenticate rather than silently receiving
tenant-admin capabilities.
