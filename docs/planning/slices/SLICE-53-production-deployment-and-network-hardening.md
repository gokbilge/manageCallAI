# SLICE-53 Production Deployment And Network Hardening

## Priority

P0 - production release gate

## Status

PLANNED

## Goal

Provide a tested production deployment path for a single-region manageCallAI
installation, including network boundaries, TLS, SIP/TLS/SRTP/NAT guidance,
reverse proxy rules, secrets, and operational startup order.

## Context

The existing production deployment guide covers important topics, but production
readiness needs a tested, opinionated deployment shape that operators can follow
without inferring boundaries from architecture docs. Telecom deployment is
especially sensitive because SIP scanners, NAT mistakes, media-path exposure,
and leaked runtime endpoints create real fraud and outage risk.

## Depends On

- `SLICE-49-public-alpha-readiness.md`
- `SLICE-50-self-hosted-freeswitch-smoke-ci.md`
- `SLICE-52-production-runtime-e2e-gate.md`

## Scope

- Create or harden a production single-server and small-cluster deployment
  guide.
- Define network zones for public HTTP, private API/runtime, FreeSWITCH SIP/RTP,
  PostgreSQL, worker, Go agent, and observability endpoints.
- Document reverse proxy rules, TLS termination, CORS, HSTS, request-size limits,
  timeout behavior, and access-log redaction.
- Document SIP TLS, SRTP, RTP port range, NAT, firewall, carrier trunk, and
  extension registration assumptions.
- Define startup, health, readiness, graceful shutdown, and rollback order.
- Add Docker Compose production example or reference manifest if it can be kept
  secure by default.
- Add deployment validation checklist and production preflight command/script
  where practical.

## Acceptance Criteria

- A new operator can deploy a non-toy production-like environment from docs.
- Runtime endpoints are private or explicitly allowlisted.
- FreeSWITCH SIP/RTP exposure is documented separately from API exposure.
- Default examples do not expose PostgreSQL, ESL, runtime API tokens, or
  management endpoints publicly.
- Deployment preflight checks required secrets, APP_ENV, runtime token policy,
  database connectivity, health/readiness, and FreeSWITCH reachability.
