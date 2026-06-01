# SLICE-57 Carrier Interop Certification

## Priority

P0 - production carrier-readiness gate

## Status

COMPLETED

## Goal

Create a carrier interoperability evidence gate for SIP registration, call
routing, DTMF, hangup/CDR behavior, TLS/NAT expectations, and failover
exceptions.

## Context

FreeSWITCH XML golden tests and runtime E2E checks prove manageCallAI behavior.
They do not prove a specific carrier or SBC profile works with the selected SIP
transport, codec policy, NAT mode, DTMF mode, and failover expectations.

## Scope

- Add `pnpm carrier:interop-check`.
- Validate a carrier evidence JSON file.
- Require scenarios for SIP register, inbound call, outbound call, RFC2833 DTMF,
  hangup/CDR, TLS or documented exception, NAT media path, and failover or
  documented exception.
- Document the evidence format and release gate.

## Acceptance Criteria

- Missing or failed carrier scenarios fail non-zero.
- Documented exceptions require an explicit reason.
- Production release checklist requires carrier evidence for each enabled
  carrier/SBC profile.
- No SIP passwords, bearer tokens, recordings, or customer CDRs are stored in
  the evidence file.

## Dependencies

- Depends on `SLICE-52` runtime E2E and `SLICE-53` network hardening.
- Feeds production launch approval for each trunk provider.
