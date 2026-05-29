# SLICE-21 Enterprise and Multi-Tenant Hardening

## Goal

Add the enterprise-grade controls and topology hardening that only make sense
after the release product is proven.

## Status

**COMPLETED** — 2026-05-29

## Scope

- richer role model beyond the current tenant admin baseline
- SSO/SAML and enterprise identity options
- multi-region or multi-agent topology hardening
- stronger audit, residency, and compliance posture where explicitly required

## Depends On

- `SLICE-11`
- `SLICE-19`
- `SLICE-20`

## Parallel With

- late-stage enterprise feature packaging

## Unblocks

- enterprise sales readiness
- regulated-customer adoption
- broader organization and compliance requirements

## Exit Criteria

- enterprise features are added as explicit product capabilities, not ad hoc patches
- tenant isolation guarantees remain stronger, not weaker, after hardening
- operational guidance exists for the supported topology

## Shipped

### A. Richer role model

Added `tenant_operator` and `tenant_viewer` roles, backed by a new `role` column on
`users` (migration `0018_user_roles.sql`). The DB check constraint covers all four
values: `tenant_admin`, `tenant_operator`, `tenant_viewer`, `platform_admin` override
stays in config.

- `tenant_viewer` — all VIEW capabilities; no mutations.
- `tenant_operator` — viewer + create/update/validate/simulate/activate/test; no
  publish, rollback, approve-decide, deactivate, or manage-keys.
- `tenant_admin` — full tenant capabilities (all of the above plus destructive and
  approval actions).
- `platform_admin` — granted via `config.platformOperatorEmails` at JWT issuance;
  adds platform-scoped capabilities on top of all tenant capabilities.

Role is now read from the DB row on login; the controller applies the
`platform_admin` override only when the email matches config.

Files changed: `auth.repository.ts`, `auth.service.ts`, `auth.types.ts`,
`auth.controller.ts`, `capabilities.ts` (API + web).

### B. Tenant audit log

`tenant_audit_log` table (migration `0019_tenant_audit_log.sql`) captures actor,
action, resource, and JSON metadata per-tenant with a descending time index.

- `AuditRepository` — `log()` INSERT + `find()` with optional action/resource_type/
  since/limit filters, capped at 500 rows.
- `AuditService` — thin delegation layer.
- `fire-audit.ts` — fire-and-forget singleton (mirrors webhook-delivery pattern);
  errors swallowed so audit failures never break the primary request.
- `GET /api/v1/audit` — requires `TENANT_AUDIT_LOG_VIEW` (tenant_operator and above).
- Audit events wired into `approval.controller.ts` (approve/reject) and
  `ivr-flow.controller.ts` (publish/rollback).

### C. Ops topology doc

`docs/ops/multi-tenant-topology.md` — operational reference for tenant isolation,
DB partitioning, FreeSWITCH multi-tenant deployment, and role assignment process.

### Tests

261 unit tests passing. New test coverage:
- `capabilities.test.ts` — 6 new tests for `tenant_operator` and `tenant_viewer`
- `audit.service.test.ts` — 5 tests

## Out Of Scope

- SSO/SAML identity integration (later enterprise sprint)
- Multi-region FreeSWITCH clustering
- generic "scale everything" claims with no measured proof
