# Multi-Tenant Topology

Operational reference for running manageCallAI in a multi-tenant configuration.

## Tenant isolation model

Each tenant is a row in the `tenants` table with a unique `id` (UUID) and a unique
`slug`. Every domain entity (`extensions`, `ivr_flows`, `phone_numbers`, …) carries a
`tenant_id` foreign key. The API enforces tenant scope by extracting `tenant_id` from
the JWT on every request — no cross-tenant data access is possible through the API
layer.

The DB does not use row-level security; isolation is enforced entirely in the
application layer via explicit `WHERE tenant_id = $n` clauses. All queries use
parameterised values — no dynamic SQL that could allow injection.

## Database

A single PostgreSQL 17 instance serves all tenants. Schemas are shared; tenants are
isolated by `tenant_id`. To partition a high-volume tenant (e.g. heavy CDR writes)
in the future, move their rows to a separate schema or instance without changing the
API — the repository layer is the only coupling point.

Key indexes are `(tenant_id, <sort column> DESC)` to ensure all queries are
O(log n) against the per-tenant slice regardless of total row count.

## FreeSWITCH

A single FreeSWITCH node handles all tenants. Tenant routing happens through the
manageCallAI directory service (the Lua ESL agent resolves the incoming DID to a
`tenant_id` and sets channel variables before routing). FreeSWITCH itself is
unaware of the tenant model; isolation lives in the Lua layer.

To add a second FreeSWITCH node, point its directory/config at the same API. Each
ESL agent polls `/api/v1/runtime/outbound/pending?tenant_id=…` independently. No
coordination between nodes is required for normal operation.

## Role assignment

Users are created with `role = 'tenant_admin'` by default (the first user to register
a tenant slug). An admin can change another user's role by running a direct SQL
`UPDATE users SET role = '<role>' WHERE id = '<user_id>'` until a role-management API
is added.

Valid roles:

| Role | Capabilities |
|---|---|
| `tenant_viewer` | Read-only access to all tenant resources |
| `tenant_operator` | Viewer + create/update/validate/simulate/run, no publish or admin |
| `tenant_admin` | Full tenant control including publish, rollback, approve, deactivate |
| `platform_admin` | Granted by config (`PLATFORM_OPERATOR_EMAILS`); adds platform-scoped endpoints |

The `platform_admin` role is assigned at JWT issuance based on the env list — it
does not come from the DB column.

## Audit log

All approval decisions and IVR flow publish/rollback events are recorded in
`tenant_audit_log` with actor, role, action, resource type, resource ID, and
optional JSON metadata. Audit records are append-only; no API endpoint deletes them.

Retention: currently unlimited. Add a cron `DELETE FROM tenant_audit_log WHERE
created_at < now() - interval '1 year'` if retention limits are needed.

## Network boundary

| Port | Service | Exposed to |
|---|---|---|
| 3000 | manageCallAI API | Internal only (reverse proxy or VPN) |
| 5432 | PostgreSQL | Internal only |
| 8021 | FreeSWITCH ESL | Localhost only (ESL agent runs on the same host) |

Do not expose the API port directly to the public internet; put it behind a TLS
terminating reverse proxy (nginx, Caddy, or a load balancer).
