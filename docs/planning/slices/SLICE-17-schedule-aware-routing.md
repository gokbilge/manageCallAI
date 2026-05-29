# SLICE-17 Schedule-Aware Routing

## Goal

Introduce schedule-aware and condition-aware routing as explicit desired state.

## Status

**COMPLETED** — 2026-05-29

### Shipped

- DB migration `0014_schedules.sql` — `schedules` table with `timezone`, `weekly_rules_json`, `holiday_overrides_json`
- Schedule CRUD API: `GET/POST /api/v1/schedules`, `GET/PATCH /api/v1/schedules/:id`, `POST /api/v1/schedules/:id/deactivate`
- Capabilities: `tenant.schedules.view/create/update` added to `tenant_admin` in both API and web
- `business_hours` IVR node type: structural validation, semantic validation (schedule active/exists), schedule-aware simulation (`now` respected), runtime resolver (live clock evaluation)
- Timezone-aware schedule evaluation utility (`isInBusinessHours`) with holiday override priority
- Web UI: Schedules list + create form page at `/tenant/schedules`
- Sidebar nav entry, router route under capability guard
- 18 tests: 10 schedule service, 8 schedule util, 4 web page

## Scope

- schedules resource with timezone-aware recurring windows
- holiday and one-off override model
- business-hours evaluation in validation, simulation, and runtime resolution
- caller-number and conditional routing extensions where they fit the same model

## Depends On

- `SLICE-07`
- `SLICE-15`

## Parallel With

- `SLICE-16`
- `SLICE-19`

## Unblocks

- business-hours routing
- holiday exceptions
- more realistic production call handling policies

## Exit Criteria

- schedules can be modelled, validated, simulated, and referenced safely
- runtime behavior is pinned to published schedule state for the life of a call
- operator UI exposes schedule configuration clearly enough for production use

## Out Of Scope

- workforce management
- predictive routing
