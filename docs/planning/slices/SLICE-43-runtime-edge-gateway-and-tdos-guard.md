# SLICE-43 Runtime Edge Gateway And TDoS Guard

## Goal

Protect FreeSWITCH-facing runtime endpoints and SIP ingress from scanner traffic,
spoofed runtime callers, abusive polling, and Telephony Denial of Service (TDoS)
patterns.

The design separates SIP edge protection from runtime HTTP protection:

- SIP traffic is filtered before it reaches FreeSWITCH.
- `mod_xml_curl`, IVR runtime, event ingest, and agent polling endpoints are
  protected by a runtime edge gateway with cryptographic FreeSWITCH node identity.

## Depends On

- `SLICE-39-ci-telecom-safety-gates.md`
- `SLICE-40-p1-runtime-and-operations-hardening.md`
- `SLICE-42-ai-dry-run-audit-identity-and-tracing.md`

## Scope

### Runtime Edge Gateway

- Introduce a deployment boundary for FreeSWITCH-facing HTTP endpoints:
  `/api/v1/freeswitch/*`, `/api/v1/runtime/*`, and internal ingest paths.
- Require every FreeSWITCH node or adapter agent to authenticate with a
  cryptographic node token instead of only a shared runtime token.
- Support signed requests with:
  - `X-ManageCallAI-Node-Id`
  - `X-ManageCallAI-Timestamp`
  - `X-ManageCallAI-Nonce`
  - `X-ManageCallAI-Signature`
- Verify node status, token version, timestamp freshness, nonce replay, source
  network, and allowed endpoint capabilities before forwarding to handlers.
- Keep query/body runtime-token fallback disabled by default in production.

### FreeSWITCH Node Registry

- Add desired-state records for FreeSWITCH nodes:
  - node id
  - display name
  - status
  - allowed CIDR list
  - token key id / rotation metadata
  - allowed runtime capabilities
  - rate-limit policy
- Store node token material as write-only operational secrets.
- Support token rotation without downtime through active and next key ids.

### Per-Node Runtime Rate Limits

- Add per-node, per-endpoint-family limits for:
  - directory XML lookup
  - dialplan XML lookup
  - IVR session start/advance
  - outbound-call polling
  - event/CDR/registration ingest
- Return predictable runtime-safe failures when a limit is exceeded.
- Emit metrics and audit/security events for limit breaches.
- Keep limits tenant-aware where a node serves multiple tenants.

### SIP/TDoS Edge Guidance

- Document that SIP scanner filtering belongs at the SIP edge, not inside
  `mod_xml_curl`.
- Provide deployment guidance for:
  - firewall/security-group source restrictions
  - FreeSWITCH ACLs
  - fail2ban-style log blocking
  - optional SBC, Kamailio, or OpenSIPS front door
  - SIP user-agent and method-rate filters
  - emergency allowlists and carrier trunk allowlists
- Document that SIP ports and runtime HTTP endpoints should not share the same
  public exposure model.

## Non-Goals

- Do not build a full SBC inside manageCallAI.
- Do not parse or proxy RTP/media.
- Do not replace carrier-grade DDoS protection.
- Do not expose runtime HTTP endpoints directly to the public internet.
- Do not make SIP scanner blocking dependent on the API database being healthy.

## Acceptance Criteria

- Production documentation states that runtime HTTP endpoints are internal-only
  and protected by node identity, IP/CIDR policy, replay protection, and rate
  limits.
- Architecture docs distinguish SIP edge TDoS controls from runtime HTTP gateway
  controls.
- A FreeSWITCH node registry design exists with token rotation, allowed networks,
  capabilities, and per-endpoint limits.
- Runtime auth tests cover valid signatures, invalid signatures, stale
  timestamps, replayed nonces, disabled nodes, wrong source networks, and
  capability mismatches.
- Rate-limit tests cover per-node and per-endpoint-family behavior.
- Metrics and audit/security events expose blocked runtime callers and
  limit-breach events without logging raw tokens or signatures.
