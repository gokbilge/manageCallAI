# Carrier Interoperability Gate

Carrier interoperability is release evidence for each carrier or SBC profile
that will carry production traffic.

Run:

```sh
pnpm carrier:interop-check -- --evidence=artifacts/carrier-interop/acme-sbc.json
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
