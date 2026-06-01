# SLICE-55 Load And Soak Testing

## Priority

P0 - production release gate

## Status

COMPLETED

## Goal

Add a repeatable load and soak gate for runtime event ingestion and health
paths before production promotion.

## Context

The production runtime E2E gate proves correctness for one live journey. It does
not prove that runtime ingest and call-event paths stay stable under sustained
traffic. Production readiness needs evidence for latency, failure rate, and
basic durability under controlled synthetic load.

## Scope

- Add `pnpm production:soak`.
- Exercise `/health` and runtime call-event ingest with configurable duration,
  concurrency, and target request rate.
- Emit sanitized JSON evidence under `artifacts/production-soak/`.
- Document required environment and release evidence expectations.
- Keep the normal CI path deterministic via `--check-config`.

## Acceptance Criteria

- Live soak fails non-zero when the failure rate is above the release threshold.
- Evidence contains counts and failure rate, not tokens or customer data.
- Release checklist requires soak evidence for production promotion.
- The gate is optional for normal PRs but mandatory for production release
  candidates.

## Dependencies

- Depends on `SLICE-52` production runtime E2E gate.
- Feeds capacity planning and runtime SLO work.
