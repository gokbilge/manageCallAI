# SLICE-18 Outbound Routing and Trunk Policy

## Goal

Add a safe desired-state model for outbound routing, trunk selection, and basic
fraud-control policy.

## Status

**COMPLETED** — 2026-05-29

### Shipped

- DB migration `0015_outbound_routes.sql` — `outbound_routes` table with prefix matching, priority, trunk ref, fallback trunk, rate cap, caller ID allowlist, DB constraint preventing self-fallback
- CRUD API: `GET/POST /api/v1/outbound-routes`, `GET/PATCH /:id`, `POST /:id/deactivate`
- Internal runtime resolution endpoint: `POST /api/v1/outbound-routes/resolve` (runtime token auth, longest-prefix + priority selection)
- Capabilities: `tenant.outbound_routes.view/create/update` added to `tenant_admin` in API and web
- Policy validation: active trunk required, fallback must differ from primary and be active, prefix format validated, rate cap bounded 1–10000, caller ID list format validated
- Web UI: outbound routes list + create form at `/tenant/routes/outbound`
- Sidebar nav entry, router route under capability guard
- 15 API service tests, 4 web page tests

## Scope

- outbound route resources
- dial rule and prefix matching
- trunk selection and failover policy
- basic outbound guardrails such as rate caps or policy blocks
- API and UI surfaces for safe operator control

## Depends On

- `SLICE-03`
- `SLICE-06`
- `SLICE-11`

## Parallel With

- `SLICE-19`

## Unblocks

- click-to-call and supervised outbound features
- policy-aware carrier control
- later call supervision work

## Exit Criteria

- outbound routes exist as tenant-scoped desired state
- outbound trunk policy is validated before production use
- no raw FreeSWITCH dialplan editing or raw ESL control is exposed publicly

## Out Of Scope

- full campaign dialer
- compliance integrations unless explicitly scoped
