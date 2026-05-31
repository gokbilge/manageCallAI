# SLICE-56 Production Observability, Soak Tests, And SLOs

## Priority

P1 - production release gate

## Status

PLANNED

## Goal

Define and verify production observability, SLOs, alerting, and soak/load tests
for runtime lookup, call-event ingestion, webhook delivery, outbound call
requests, queue state, recording backlog, and FreeSWITCH agent health.

## Context

Telecom runtime failures are time-sensitive. Operators need clear signal for
directory/dialplan latency, runtime callback failures, event ingestion lag,
webhook DLQ growth, outbound fraud blocks, registration failures, and agent
heartbeats. Production readiness requires both dashboards and tests that stress
critical paths.

## Depends On

- `SLICE-37-live-observability-cockpit.md`
- `SLICE-52-production-runtime-e2e-gate.md`
- `SLICE-55-production-fraud-abuse-and-rate-limits.md`

## Scope

- Define SLOs for runtime lookup latency, API availability, event ingestion lag,
  webhook delivery latency, outbound request handling, and observability stream
  freshness.
- Add Prometheus metrics and alert rules where missing.
- Add structured log fields for request_id, tenant_id, actor_type, call_id,
  flow_id, route_id, runtime component, and error code where safe.
- Add soak/load tests for call-event ingestion, timeline query, runtime lookup,
  webhook retry/DLQ, and observability summary.
- Add FreeSWITCH agent heartbeat and stale-agent alerts.
- Add dashboard/runbook docs for common production incidents.

## Acceptance Criteria

- Production SLOs are documented and mapped to metrics.
- Alert rules exist for runtime lookup latency, runtime auth failures, outbound
  bursts, webhook DLQ growth, stale agents, and event ingestion lag.
- Soak/load test commands produce repeatable reports.
- Logs remain redacted under high-volume tests.
- Release checklist requires SLO/soak evidence for production candidates.
