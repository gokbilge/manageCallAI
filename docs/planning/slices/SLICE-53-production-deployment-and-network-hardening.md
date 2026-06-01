# SLICE-53 Production Deployment And Network Hardening

## Priority

P0 - production deployment gate

## Status

COMPLETED

## Goal

Make production deployment prerequisites explicit and executable before operators
start live telecom traffic.

## Context

The deployment guide documents the desired runtime shape, but production
operators need a preflight command that checks dangerous defaults and missing
network/security settings before the first deploy or an upgrade.

## Scope

- Add `pnpm production:preflight` for production environment validation.
- Block weak or missing `APP_ENV`, JWT, runtime token, and SIP master key
  configuration.
- Flag known unsafe defaults such as FreeSWITCH `ClueCon`.
- Warn on deployment-risk gaps such as missing platform operator bootstrap,
  missing explicit rate-limit settings, and missing recording storage root.
- Document edge requirements for private runtime endpoints, TLS termination,
  FreeSWITCH node allowlisting, SIP/TLS/SRTP/NAT ownership, and log redaction.
- Keep OpenAPI as the contract surface and design/architecture docs as the
  single source of product intent.

## Acceptance Criteria

- Production preflight exits non-zero on blocking unsafe defaults.
- Warnings distinguish operational follow-up from release blockers.
- Deployment docs tell contributors where new production logic belongs.
- Runtime and FreeSWITCH endpoints remain private/internal by default.

## Dependencies

- Depends on `SLICE-44` production readiness hardening.
- Supports `SLICE-52` runtime E2E and `SLICE-54` restore validation.
