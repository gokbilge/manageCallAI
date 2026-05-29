# SLICE-22 Recorded Media and Export Operations

## Goal

Add the recorded-media and data-export follow-on work that remains after core
session replay and flow-history observability are in place.

## Status

**COMPLETED** — 2026-05-29

## Scope

- call recording metadata and playback-safe storage references
- recording visibility in tenant and platform operator surfaces
- export/reporting endpoints for call events and session history
- bounded operational data export flows that stay tenant-safe

## Depends On

- `SLICE-19`

## Parallel With

- `SLICE-20`
- `SLICE-21`

## Unblocks

- richer operator debugging
- reporting/export workflows
- future recording-aware AI and automation features

## Exit Criteria

- recording metadata is first-class and tenant-scoped
- operators can access replay-adjacent recordings through safe product surfaces
- export/reporting behavior is documented and tested

## Shipped

### A. Call recording metadata

`call_recordings` table (migration `0020_call_recordings.sql`) — tenant-scoped,
associated with a `call_id` and optionally a `call_event_id`. Stores a
`storage_path` reference (filesystem path or object-store key), `duration_secs`,
`size_bytes`, and a `status` field (`pending`, `available`, `deleted`).

API (`/api/v1/recordings`):
- `GET /` — list recordings for the authenticated tenant, optional `call_id` filter
- `GET /:id` — get a single recording by ID
- `POST /internal/ingest` — runtime auth (ESL agent registers a completed recording)

Requires `TENANT_RECORDINGS_VIEW` (all roles including `tenant_viewer`).

### B. Bounded export endpoints

API (`/api/v1/export`):
- `GET /call-events` — export call events for the tenant, filtered by `since`/`until`
  date-time range, capped at 1000 rows
- `GET /sessions` — export IVR session summaries with the same filters and cap

Requires `TENANT_EXPORT_RUN` (tenant_operator and above, not viewer). Response
includes `{ data: [...], count: N }`.

### C. Capabilities

- `TENANT_RECORDINGS_VIEW` — added to `tenant_viewer` level and above
- `TENANT_EXPORT_RUN` — added to `tenant_operator` level and above

Both capabilities added to API and web `capabilities.ts`.

### Tests

270 unit tests passing. New test coverage:
- `recording.service.test.ts` — 5 tests
- `export.service.test.ts` — 4 tests

## Out Of Scope

- generic BI warehouse strategy
- unrestricted bulk data extraction without policy boundaries
- CSV/streaming export (JSON only at this stage)
- Signed URL generation for recording playback (storage layer not wired)
