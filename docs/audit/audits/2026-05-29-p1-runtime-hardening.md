# 2026-05-29 P1 Runtime Hardening Audit

## Scope

P1 telecom/runtime and IVR runtime hardening foundations requested after the P0
security/governance pass.

## Completed

- Added queue runtime policy fields: retry delay, maximum wait, music-on-hold,
  overflow target type, and overflow target ID.
- Added migration `0030_p1_runtime_safety.sql`.
- Extended queue API contracts, repository, service validation, and unit tests.
- Extended IVR runtime queue transfer actions to include queue behavior fields.
- Added outbound route destination allowlist/blocklist fields.
- Enforced outbound dispatch safety:
  - reject calls with no active matching route
  - reject emergency destinations
  - reject known premium-rate prefixes
  - enforce route destination blocklists
  - enforce route destination allowlists
- Updated OpenAPI and generated SDK schema.
- Fixed API-key capability contract type drift while validating the hardening tree.

## Remaining

The rest of P1 is tracked in `SLICE-40-p1-runtime-and-operations-hardening.md`.
Large items such as NAT/SIP deployment guidance, TLS/SRTP strategy, codec/DTMF
policy, CDR reconciliation, full visual IVR builder completion, MCP session auth,
n8n templates, Prometheus metrics, tracing, and production runbooks need separate
implementation slices to avoid mixing runtime policy with broad platform changes.

