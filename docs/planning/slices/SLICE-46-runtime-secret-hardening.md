# SLICE-46 Runtime Secret Hardening

## Priority

P1 - security

## Status

Planned

## Goal

Reduce runtime-token exposure risk and make runtime authentication failures
observable.

## Scope

- Remove `runtime_token` query/body fallback after migration.
- Add runtime auth failure metrics and alert events.
- Add support-bundle redaction tests for runtime token and SIP credentials.
- Add optional short-lived dual-token rotation support.
- Document deployment secret-source requirements.

## Acceptance Criteria

- Production runtime token is never accepted from URL query strings.
- Runtime token values are redacted from logs and support bundles.
- Repeated runtime auth failures produce an operator alert.
- Rotation can be completed without exposing the old token in logs.
