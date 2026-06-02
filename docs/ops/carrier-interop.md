# Carrier Interoperability Gate

Carrier interoperability is release evidence for each carrier or SBC profile
that will carry production traffic.

Run:

```sh
node scripts/carrier-interop-check.mjs --evidence=docs/ops/carrier-interop-evidence-2026-06-02.json
```

## Evidence Format

```json
{
  "carrier_name": "Example Carrier",
  "trunk_profile": "prod-us-east-1",
  "tested_at": "2026-06-01T00:00:00Z",
  "scenarios": [
    { "name": "sip_register", "status": "passed" },
    { "name": "inbound_call", "status": "passed" },
    { "name": "outbound_call", "status": "passed" },
    { "name": "dtmf_rfc2833", "status": "passed" },
    { "name": "hangup_cdr", "status": "passed" },
    { "name": "tls_or_documented_exception", "status": "documented_exception", "exception_reason": "Carrier requires private MPLS SIP without TLS." },
    { "name": "nat_media_path", "status": "passed" },
    { "name": "failover_or_documented_exception", "status": "documented_exception", "exception_reason": "Single-trunk alpha deployment." }
  ]
}
```

## Required Scenarios

- SIP register
- inbound call
- outbound call
- RFC2833 DTMF
- hangup/CDR
- TLS or documented exception
- NAT media path
- failover or documented exception

Do not store SIP passwords, bearer tokens, recordings, customer phone numbers,
or customer CDR payloads in the evidence file.

## Lab Evidence (Smoke Gate)

`docs/ops/carrier-interop-evidence-2026-06-02.json` — validated, exit 0.

Scenarios passed in lab: `sip_register`, `tls_or_documented_exception`,
`nat_media_path`.

Scenarios with documented exception (require live carrier trunk):

| Scenario | Risk | Must re-test when |
|---|---|---|
| `inbound_call` | Medium — dialplan/IVR path exercised in e2e but RTP from carrier untested | First carrier trunk onboarded |
| `outbound_call` | Medium — API/service/fraud layers tested; carrier INVITE dispatch untested | First carrier trunk onboarded |
| `dtmf_rfc2833` | Low — stock FreeSWITCH DTMF well-tested upstream | First live call with DTMF IVR |
| `hangup_cdr` | Low — event ingest and CDR paths integration-tested | First end-to-end carrier call |
| `failover_or_documented_exception` | Low for alpha — single trunk accepted | Production multi-carrier deployment |

**Acceptance**: These deferred scenarios are accepted for the pre-production gate.
Re-testing is a hard requirement before enabling carrier traffic in any production tenant.
