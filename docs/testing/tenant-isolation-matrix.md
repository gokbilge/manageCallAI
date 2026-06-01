# Tenant Isolation Matrix

This document maps each tenant-scoped resource to the isolation tests that cover
it. Tests live in `apps/api/src/modules/auth/rbac-matrix.integration.test.ts`
under the `cross-tenant isolation matrix` describe block.

## Coverage Status

| Resource | List isolation | Read-by-ID isolation | Write isolation | Runtime-ingest isolation | Test file |
|---|---|---|---|---|---|
| Extensions | ✅ | ✅ | — | — | rbac-matrix |
| SIP trunks | ✅ | ✅ | ✅ | — | rbac-matrix |
| Phone numbers | ✅ | ✅ | — | — | rbac-matrix |
| IVR flows | ✅ | ✅ | ✅ | — | rbac-matrix |
| IVR flow versions | — | ✅ | — | — | rbac-matrix |
| IVR flow publish | — | — | ✅ | — | rbac-matrix |
| IVR flow rollback | — | — | ✅ (via publish test) | — | rbac-matrix |
| Inbound routes | ✅ | — | ✅ | — | rbac-matrix |
| Outbound routes | ✅ | — | — | — | rbac-matrix |
| Call events | — | — | — | ✅ | rbac-matrix |
| Recordings | ✅ | — | — | — | rbac-matrix |
| Automation webhooks | ✅ | — | ✅ (delete) | — | rbac-matrix |
| API keys (automation) | — | — | — | — | rbac-matrix (API key scope test) |
| Fraud outbound policy | ✅ | — | — | — | rbac-matrix |
| Export | — | — | ✅ | — | rbac-matrix |
| Platform node registry | ✅ | ✅ | ✅ | — | rbac-matrix |
| Approvals | ✅ | — | ✅ (decide) | — | rbac-matrix |
| Audit log | ✅ | — | — | — | rbac-matrix |
| Schedules | ✅ | ✅ | ✅ | — | rbac-matrix |
| Queues | ✅ | ✅ | ✅ | — | rbac-matrix |

Legend: ✅ tested | — not yet tested

## Test Location

```
apps/api/src/modules/auth/rbac-matrix.integration.test.ts
  └── RBAC capability matrix + tenant isolation
      └── cross-tenant isolation matrix
```

The file also covers:
- RBAC capability matrix per role (extensions, IVR flows)
- API key capability enforcement
- Platform admin JWT scope

## Runtime Actor Boundary Tests

Runtime actor (FreeSWITCH → API) boundaries are covered separately:

```
apps/api/src/modules/runtime/runtime-boundary.integration.test.ts
```

These tests verify:
- Runtime Bearer token rejected on user CRUD endpoints
- User JWT rejected on runtime-only ingest endpoints
- Tenant ID confusion between `x-tenant-id` header and JWT claims

## Remaining Gaps for Beta

All beta-critical isolation gaps are now covered. No remaining required items.

## Acceptance Criteria

A test passes for "isolation" when:
- List endpoints return 0 items for resources belonging to another tenant.
- Read-by-ID endpoints return 404 (not 403) so resource existence is not revealed.
- Write/delete endpoints return 403 or 404 for resources of another tenant.
- Runtime ingest endpoints accept the correct `x-tenant-id` and cannot be
  redirected by a forged header from a different tenant's JWT.
