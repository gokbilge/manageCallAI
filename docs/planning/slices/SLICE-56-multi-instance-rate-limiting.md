# SLICE-56 Multi-Instance Rate Limiting

## Priority

P0 - production deployment gate

## Status

COMPLETED

## Goal

Prevent operators from scaling the API horizontally while relying only on
per-process in-memory rate limits, and provide a built-in Redis shared-store
option for production multi-instance deployments.

## Context

The API includes in-process rate limits for auth, runtime, webhook, outbound,
and general API traffic. That is acceptable for one process. In multi-instance
production deployments, limits must be enforced by a shared store or by an edge
gateway policy that applies before requests reach any API instance.

## Scope

- Add `pnpm production:rate-limit-check`.
- Fail production preflight when `MANAGECALLAI_INSTANCE_COUNT > 1` and neither
  `RATE_LIMIT_EXTERNAL_ENFORCED=true` nor `EDGE_RATE_LIMIT_ENFORCED=true` is set.
- Warn when explicit production limit values are missing.
- Document accepted topologies and required evidence.
- Implement `RATE_LIMIT_STORE=redis` with `RATE_LIMIT_REDIS_URL` for shared API
  rate limits across instances.

## Acceptance Criteria

- Multi-instance deployments cannot pass the topology check without Redis,
  another external limiter, or edge limiter evidence.
- Single-instance deployments continue to pass with warnings for missing
  explicit limits.
- Release checklist includes rate-limit topology evidence.
- The check does not expose credentials.
- Redis store behavior is unit-tested without requiring a live Redis service.

## Dependencies

- Depends on `SLICE-53` production deployment and network hardening.
- Supports `SLICE-55` soak testing by making traffic limits meaningful across
  instances.
