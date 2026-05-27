# ADR-0008: Platform Operator Bootstrap via Email Allowlist

**Status:** Accepted

## Context

manageCallAI is a multi-tenant control plane. The API distinguishes two role
classes:

- `tenant_admin` — scoped to one tenant; created by self-registration.
- `platform_admin` — cross-tenant; can view all tenants, inspect runtime health,
  and read audit data.

At early product stage there is no dedicated admin UI, no invite flow, and no
separate identity store for platform operators. We need a way to grant platform
access to the initial operator (typically the developer or SaaS owner) without
blocking the MVP or adding a separate identity subsystem.

## Decision

Platform operator identity is bootstrapped through the `PLATFORM_OPERATOR_EMAILS`
environment variable — a comma-separated list of email addresses.

When a user authenticates (register or login), the API checks their email against
this list. If matched, the JWT claim `role` is set to `platform_admin`; otherwise
it defaults to `tenant_admin`. No separate platform user table or invite token is
required.

The check lives in `apps/api/src/modules/auth/auth.controller.ts` and reads from
`apps/api/src/config/env.ts` (`platformOperatorEmails`, default `[]`).

Frontend capability gating (`RequireCapability`) and backend `requireCapability`
preHandlers both read the `role` claim from the JWT, so no additional session
state is needed.

## Consequences

**Good:**

- Zero extra tables, migrations, or admin bootstrapping flows at MVP stage.
- Operators can be added or removed by redeploying with an updated env var, which
  matches how environment-based secrets are managed in this stack.
- The role is embedded in the JWT, so capability checks are stateless and
  consistent across API and frontend.

**Accepted limitations:**

- Platform access is tied to email address, not to a cryptographic credential.
  An attacker who registers with a listed email before the legitimate operator
  would gain platform access. Mitigate by setting `PLATFORM_OPERATOR_EMAILS`
  before the first deploy.
- Revoking access requires redeployment (JWT TTL drains naturally; there is no
  token invalidation endpoint).
- Not suitable for production multi-operator environments where audit trails
  for platform access grants are required.

## Future migration path

When any of the following become necessary, migrate to a DB-backed identity
model:

- More than two or three platform operators
- Granular platform permission scopes beyond the current three capabilities
- Audit log of who was granted/revoked platform access and when
- Self-service platform operator invite flow

Migration steps will be:
1. Add a `platform_operators` table (or `role` column on `tenant_users`).
2. Seed it from `PLATFORM_OPERATOR_EMAILS` on first startup.
3. Remove the env-var check from `auth.controller.ts`.
4. Issue JWTs from the DB-backed role.
5. Remove `PLATFORM_OPERATOR_EMAILS` from env config.

The JWT shape (`role` claim) does not change, so no frontend or downstream
client changes are required.
