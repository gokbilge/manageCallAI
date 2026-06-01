# SLICE-58 Runtime SLO Release Gate

## Priority

P0 - production release gate

## Status

COMPLETED

## Goal

Require release-candidate evidence that runtime lookup endpoints stay within
the latency thresholds that FreeSWITCH depends on.

## Context

The production deployment guide defines runtime SLOs for directory lookup,
dialplan lookup, and readiness. Those SLOs need a machine-checkable release
gate so production promotion cannot rely only on prose or manual review.

## Scope

- Add `pnpm production:slo-check`.
- Validate sanitized JSON evidence for runtime lookup latency.
- Require evidence for `/api/v1/freeswitch/directory`,
  `/api/v1/freeswitch/dialplan`, and `/health/ready`.
- Fail when any p99 exceeds the documented breach threshold.
- Warn when p99 exceeds the target but remains below the breach threshold.
- Keep normal PR verification deterministic via `--check-config`.

## Acceptance Criteria

- Missing endpoint evidence fails non-zero.
- Breach-threshold violations fail non-zero.
- Target-threshold warnings are visible but do not block when below breach.
- Release checklist requires SLO evidence before production promotion.

## Dependencies

- Depends on `SLICE-52` production runtime E2E gate.
- Depends on `SLICE-55` load and soak testing.
- Feeds production SLO dashboards and incident-response runbooks.
