# Runtime Edge Security

## Purpose

This document defines the production boundary for FreeSWITCH-facing runtime
traffic. It covers two different threat surfaces:

- SIP/TDoS traffic that targets FreeSWITCH signaling ports.
- Runtime HTTP traffic that FreeSWITCH, `mod_xml_curl`, and adapter agents send
  to manageCallAI.

These surfaces must be protected differently.

## SIP Edge Protection

SIP scanner and TDoS filtering belongs before SIP traffic reaches FreeSWITCH.
Use one or more of:

- cloud firewall or security-group rules
- carrier or SBC trunk restrictions
- Kamailio or OpenSIPS as a SIP front door
- FreeSWITCH ACLs
- fail2ban-style blocking from SIP authentication and malformed-message logs
- method and source-rate limits for `REGISTER`, `INVITE`, and `OPTIONS`
- user-agent and signature filters for known scanner patterns

SIP edge controls must continue to work even if the manageCallAI API or
PostgreSQL is unavailable.

## Runtime HTTP Edge Protection

Do not expose runtime HTTP endpoints directly to the public internet.

Runtime-facing paths include:

- `/api/v1/freeswitch/*`
- `/api/v1/runtime/*`
- internal event, CDR, registration, recording, and provider-work ingest paths

Production deployments should put these paths behind an internal runtime gateway
or private network boundary that only FreeSWITCH nodes and trusted adapter agents
can reach.

## FreeSWITCH Node Identity

Every FreeSWITCH node or runtime adapter should have its own node identity.

Expected request headers:

- `X-ManageCallAI-Node-Id`
- `X-ManageCallAI-Timestamp`
- `X-ManageCallAI-Nonce`
- `X-ManageCallAI-Signature`

The signature should cover:

- HTTP method
- path and canonical query
- timestamp
- nonce
- request body hash

The runtime gateway or API middleware must verify:

- node exists and is active
- source IP is inside the node's allowed CIDR list
- timestamp is within the accepted skew window
- nonce has not been used before
- signature matches the active or next node token
- node is allowed to call the requested endpoint family
- node has not exceeded its rate limit

## Rate Limits

Rate limits should be scoped by node id and endpoint family.

Recommended starting limits:

| Endpoint family | Scope | Initial policy |
|---|---|---|
| Directory XML lookup | node + tenant | steady low latency, short burst |
| Dialplan XML lookup | node + tenant | steady low latency, short burst |
| IVR runtime advance | node + active session | strict burst protection |
| Outbound polling | node | fixed poll interval with jitter |
| Event/CDR ingest | node | larger burst with queue backpressure |

When a limit is exceeded, return a deterministic error, emit metrics, and record
a security event. Do not log raw tokens, signatures, SIP credentials, or customer
call payloads.

## Token Rotation

Node tokens are operational secrets. They must be write-only and rotated without
downtime.

Recommended model:

- active key id
- next key id
- activation time
- revocation time
- last-used timestamp
- last-used source IP

The verifier should accept the active token and, during a rotation window, the
next token. Disabled nodes and revoked key ids must fail closed.

## Deployment Rule

SIP ports may be internet-facing only through the SIP edge controls above.
Runtime HTTP endpoints should be private, authenticated with node identity,
rate-limited, and monitored.
