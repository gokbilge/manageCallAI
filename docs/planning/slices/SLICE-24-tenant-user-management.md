# SLICE-24 Tenant User Management

## Goal

Give tenant admins a product-surface way to list team members, add new users, update
roles, and deactivate users — eliminating the direct-SQL workaround documented in
the SLICE-21 ops topology guide.

## Status

**COMPLETED** — 2026-05-29

## Scope

- `GET /api/v1/users` — list users in the authenticated tenant
- `GET /api/v1/users/:id` — get a single user
- `POST /api/v1/users` — add a user to the tenant (email, display_name, role, password)
- `PATCH /api/v1/users/:id` — update display_name and/or role
- `DELETE /api/v1/users/:id` — soft-deactivate (status → inactive)
- Guard rules: actor cannot change their own role; only the three tenant roles may be
  assigned (platform_admin is config-only, never writable through this API)
- Audit events fired on user.created, user.role_changed, user.deactivated

## Capabilities

- `TENANT_USERS_VIEW` — tenant_operator and above
- `TENANT_USERS_MANAGE` — tenant_admin only

## Depends On

- `SLICE-21` (role model established)

## Shipped

### API: `/api/v1/users`

- `GET /` — list all users in the tenant (`TENANT_USERS_VIEW`)
- `GET /:id` — get a user by ID (`TENANT_USERS_VIEW`)
- `POST /` — add a user to the tenant: email, display_name, role, password (`TENANT_USERS_MANAGE`)
- `PATCH /:id` — update display_name and/or role (`TENANT_USERS_MANAGE`)
- `DELETE /:id` — soft-deactivate: sets `status = 'inactive'` (`TENANT_USERS_MANAGE`)

### Guard rules (service layer)

- Actor cannot change their own role (`UserOperationForbiddenError` → 403)
- Actor cannot deactivate their own account (`UserOperationForbiddenError` → 403)
- `platform_admin` is rejected as a writable role; only the three tenant roles are accepted
- Duplicate email within a tenant → `UserConflictError` → 409

### Audit events

`user.created`, `user.role_changed`, `user.deactivated` are fire-and-forget written
to `tenant_audit_log` via the existing `fireAuditEvent` helper.

### Capabilities

- `TENANT_USERS_VIEW` — tenant_operator and above (in `TENANT_OPERATOR_CAPABILITIES`)
- `TENANT_USERS_MANAGE` — tenant_admin only (in `TENANT_CAPABILITIES` admin additions)

Both capabilities added to API and web `capabilities.ts`.

### Tests

282 unit tests passing. New: `user.service.test.ts` — 12 tests covering all service
methods, guard rules, and error paths. bcrypt rounds exercised in the create tests
(explains the ~650ms runtime for that file).

## Out Of Scope

- Invitation token / email flow (user receives a password directly for now)
- Password reset API
- SSO / SAML provisioning
