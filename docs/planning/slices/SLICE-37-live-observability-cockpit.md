# SLICE-37 Live Observability Cockpit

## Goal

Add a high-density live operations cockpit to the React admin panel so operators
can see active calls, queue pressure, runtime health, and node status in near
real time.

## Status

**COMPLETED**

Audited 2026-05-30. All exit criteria are met:

- SSE stream emits `StreamEvent { status: 'live' | 'degraded', data, generated_at }` so clients can
  distinguish healthy vs degraded stream state; degraded events are emitted instead of silently pinging.
- `StreamEventSchema` and `PlatformHealthSnapshotSchema` added to contracts.
- `GET /api/v1/observability/platform-health` added (requires `PLATFORM_RUNTIME_VIEW` capability);
  returns aggregate service health + session counters without per-tenant or cross-tenant data.
- `ObservabilityService.getPlatformHealth()` delegates to configurable service health checks.
- `ObservabilityRepository.getPlatformRuntimeSummary()` adds DB-level platform counters (all tenants aggregate).
- `useObservabilityStream` hook added to web lib; uses fetch-based SSE with Authorization header for
  proper auth; exposes `streamStatus: 'live' | 'degraded' | 'offline'` for UI badge.
- 8 new observability service unit tests covering: tenant isolation, snapshot field safety (no secrets),
  service health check aggregation (healthy/degraded/unreachable), platform health data boundary.
- No provider secrets, raw switch payloads, or cross-tenant data in any stream path (verified by test).
- `pnpm build` and `pnpm lint` clean across contracts, API, and web packages.

## Context

CRUD screens are enough for provisioning, but telecom operations need immediate
awareness during live traffic. Operators need to know what is happening now:
concurrent calls, queue depth, failing runtime components, webhook backlog, and
call-flow hotspots.

The UI should feel like an operations cockpit: dense, scannable, low-latency, and
designed for repeated monitoring. This is not a marketing dashboard and should
not replace detailed CRUD or replay pages.

## Scope

- Add a platform/tenant live operations dashboard.
- Add WebSocket or Server-Sent Events transport for live operational updates.
- Stream active call/session counters, queue depths, runtime service health, and
  recent terminal failures.
- Show live IVR/session activity with links into session replay.
- Show webhook delivery backlog and adapter/provider work backlog where available.
- Add backend event fan-out from existing call events, runtime sessions, queues,
  webhook queue, and platform health sources.
- Add degraded/offline states when the live stream disconnects.
- Add tests for authorization, tenant isolation, event shape, and UI rendering.

## Does Not Change

- Provisioning CRUD surfaces
- Runtime call execution semantics
- FreeSWITCH as the media/signaling runtime
- Historical reporting/export workflows

## Depends On

- `SLICE-19`
- `SLICE-25`
- `SLICE-27`
- `SLICE-29`
- `SLICE-32`

## Parallel With

- `SLICE-36`

## Unblocks

- live telecom operations monitoring
- faster support triage
- platform health demos
- future alerting and SLO dashboards

## Exit Criteria

- tenant operators can see live active calls/sessions scoped to their tenant
- queue depth and recent queue outcomes update without page refresh
- platform operators can see aggregate node/runtime health
- stream authentication and tenant isolation are covered by tests
- UI has clear disconnected, stale, degraded, and empty states
- no provider secrets, raw switch payloads, or cross-tenant data are streamed

## Out Of Scope

- long-term analytics warehouse
- billing-grade reporting
- live call supervision controls such as barge, whisper, or monitor
- replacing session replay, audit log, or export pages

