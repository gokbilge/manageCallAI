# SLICE-48 Security Alert Rules

## Priority

P1 - security

## Status

Planned

## Goal

Create first-party abuse alerts for telecom and automation security signals.

## Scope

- Repeated failed SIP registrations.
- Outbound burst and route-limit pressure.
- Unknown destination and allowlist-denied outbound attempts.
- Runtime authentication failures.
- Webhook replay or stale timestamp attempts from first-party receiver examples.
- Recording analysis backlog and failed processing spikes.

## Acceptance Criteria

- Alerts are tenant-scoped and business-level.
- Alerts do not expose raw FreeSWITCH or provider payloads.
- Operators can acknowledge and inspect alerts.
- Alert rules are covered by tests with deterministic thresholds.
