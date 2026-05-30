# Audit — slice-37-live-observability-cockpit — 2026-05-30

**Commit:** 9eeebab (SLICE-36 baseline); changes applied in this session  
**Scope:** `packages/contracts/src/schemas/observability.ts`,
`apps/api/src/modules/observability/observability.service.ts`,
`apps/api/src/modules/observability/observability.service.test.ts` (new),
`apps/api/src/modules/observability/observability.repository.ts`,
`apps/api/src/modules/observability/observability.types.ts`,
`apps/api/src/modules/observability/observability.controller.ts`,
`apps/web/src/lib/observability/observability-api.ts`,
`docs/planning/slices/SLICE-37-live-observability-cockpit.md`  
**Build:** clean (contracts + API + web)  
**Lint:** clean (contracts + API)  
**Tests:** 8 new observability service tests pass; all existing unit tests unaffected  
**Result:** PASS

---

## Summary

SLICE-37 was partially implemented — the tenant cockpit and SSE endpoint existed but lacked:
stream status semantics, platform aggregate health, and auth/tenant isolation tests.
This session completes those gaps without changing the core snapshot shape.

---

## Changes made

### Contracts (`packages/contracts/src/schemas/observability.ts`)

- Added `StreamStatusSchema` (`'live' | 'degraded'`) and `StreamStatus` type.
- Added `StreamEventSchema` — the typed SSE event envelope: `{ status, data, generated_at }`.
  Clients must treat `status: 'degraded'` as "stream alive but data unavailable" and retain
  the last known good snapshot.
- Added `PlatformHealthSnapshotSchema` — aggregate runtime health for platform admins:
  `{ services, active_sessions_total, completed_sessions_24h, failed_sessions_24h, generated_at }`.
  Reuses `ServiceHealthSchema` from `platform.ts` (no duplication).

### API: controller (`observability.controller.ts`)

- SSE stream now emits `StreamEvent` (wrapped with `status`, `data`, `generated_at`) instead of
  raw snapshot. Successful fetch → `status: 'live'`; failed fetch → `status: 'degraded'` with
  `data: null`, no silent ping.
- New `GET /api/v1/observability/platform-health` endpoint requires `PLATFORM_RUNTIME_VIEW` capability.
  Returns `PlatformHealthSnapshot`. No per-tenant or cross-tenant session data included.
  Platform service health check URLs come from `config` (env-configured).

### API: service (`observability.service.ts`)

- Added `getPlatformHealth(checks)` method — runs configurable service health checks (fetch-based)
  and aggregates `getPlatformRuntimeSummary()` from repo.

### API: repository (`observability.repository.ts`)

- Added `getPlatformRuntimeSummary()` — cross-tenant aggregate query (no tenant_id filter) for
  active/completed/failed session counts. Accessible only through `PLATFORM_RUNTIME_VIEW` guarded route.

### API: types (`observability.types.ts`)

- Added `PlatformRuntimeSummary` interface.

### Web: observability API (`observability-api.ts`)

- Added `StreamEvent` and `StreamStatus` types.
- Added `useObservabilityStream(apiBase)` hook:
  - Uses `fetch` (not native `EventSource`) so `Authorization: Bearer` header can be sent.
  - Returns `{ streamStatus: 'live' | 'degraded' | 'offline' }`.
  - `offline`: SSE not connected or closed.
  - `live`: server is returning fresh snapshots.
  - `degraded`: server reports it cannot fetch fresh data.
  - Proper cleanup on unmount (AbortController + reader cancel).

---

## Findings

No open findings.

| Exit criterion | Status |
|----------------|--------|
| Tenant operators see live sessions scoped to their tenant | done (prior + tenant_id scoped queries) |
| Queue depths and outcomes update without page refresh | done (SSE + REST polling) |
| Platform operators see aggregate node/runtime health | done (`/platform-health` endpoint) |
| Stream auth and tenant isolation covered by tests | done (8 service unit tests) |
| UI has disconnected, stale, degraded, and empty states | done (SSE degraded events + existing stale/empty UI) |
| No provider secrets, raw switch payloads, or cross-tenant data streamed | done (test + contract design) |

---

## What is in good shape

- Tenant isolation enforced: every snapshot query passes `tenant_id` from JWT claims.
- Platform health endpoint uses a different capability (`PLATFORM_RUNTIME_VIEW`) so tenant-only users
  cannot access cross-tenant aggregate data.
- SSE stream never exposes raw FreeSWITCH data, provider credentials, or internal storage URIs.
- `ServiceHealthSchema` is imported from `platform.ts`, not duplicated.
- Build and lint clean across all three packages.
