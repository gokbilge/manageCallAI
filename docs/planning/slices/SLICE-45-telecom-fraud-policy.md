# SLICE-45 Telecom Fraud Policy

## Priority

P1 - security

## Status

Planned

## Goal

Add tenant-level and trunk-level outbound fraud controls beyond route-local
prefix rules.

## Scope

- Tenant outbound policy table.
- Country allowlist.
- Area-code allowlist.
- Premium-rate and high-risk prefix blocklists.
- Tenant, route, and trunk call attempt limits.
- Max call duration policy propagated to runtime dispatch.
- Audit events for blocked outbound attempts.
- Operator-visible fraud alerts.

## Acceptance Criteria

- New tenants deny risky outbound destinations by default.
- Policy evaluation is deterministic and unit-tested.
- Blocked attempts do not persist dispatchable outbound requests.
- Operators can see why a call was blocked.
- Emergency and premium-rate global blocks remain non-bypassable by tenant admins.
