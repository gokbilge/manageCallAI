# Runtime Token Hardening

## Runtime Boundary

The runtime token authenticates FreeSWITCH-facing and adapter-facing runtime
endpoints. It is not a user credential, not an API key, and not a workflow token.
It must only be used by trusted runtime components over private network paths or
mutual-TLS edge routes.

Preferred transport:

- FreeSWITCH node HMAC authentication with `x-managecallai-node-id`,
  `x-managecallai-timestamp`, `x-managecallai-nonce`, and
  `x-managecallai-signature` for registered runtime nodes.
- `Authorization: Bearer <RUNTIME_API_TOKEN>` for Go adapters and internal callers.
- HTTP Basic password for FreeSWITCH `mod_xml_curl` when Basic Auth is required.
- `x-managecallai-runtime-token` only for constrained adapters.

Deprecated transport:

- `runtime_token` query/body fallback. It is disabled by default in production and
  should be removed after live FreeSWITCH deployments no longer need it.

## Current Controls

- Production rejects default or weak runtime tokens.
- Runtime token fallback is disabled by default in production.
- Optional `RUNTIME_API_TOKEN_SECONDARY` supports short rolling rotation windows.
- Platform admins can register FreeSWITCH nodes at `/api/v1/platform/nodes`,
  receive a one-time raw node token, rotate that token, and restrict node
  capabilities to `dialplan`, `directory`, `event_ingest`, or `outbound_poll`.
- Node HMAC authentication enforces timestamp freshness, nonce replay
  protection, active node status, optional CIDR allowlists, and endpoint-family
  capabilities before accepting runtime requests.
- Runtime, FreeSWITCH, and call-event endpoints are rate limited.
- Runtime tenant identity is supplied out-of-band through `x-tenant-id` where needed.
- Request completion logs redact token-like query parameters, including
  `runtime_token`.

## Logging Rules

Never log:

- `Authorization`
- `x-managecallai-runtime-token`
- `runtime_token`
- SIP passwords
- webhook signing secrets
- recording storage paths when they reveal private bucket or filesystem layout

Allowed log fields:

- `request_id`
- `tenant_id`
- `call_id`
- endpoint path with sensitive query values redacted
- status code and latency
- bounded business error code

## Rotation Runbook

1. Generate a new random token with at least 32 bytes of entropy.
2. For shared-token deployments, deploy `RUNTIME_API_TOKEN_SECONDARY` for a
   short-lived dual-token transition if live calls require it.
3. For node-auth deployments, use `POST /api/v1/platform/nodes/:id/rotate-token`
   and update the node secret store with the one-time returned raw token.
4. Update Go adapter and FreeSWITCH profile secrets.
5. Restart runtime components.
6. Verify `/health`, directory lookup, call event ingest, and IVR runtime session
   creation.
7. Revoke the old token and scan logs/support bundles for accidental exposure.

## Remaining Hardening Work

`SLICE-46-runtime-secret-hardening.md` implemented node registry, runtime token
rotation support, and runtime-auth failure audit events. Remaining production
hardening work:

- complete removal of query/body fallback after all supported FreeSWITCH paths can send headers or node signatures
- runtime auth failure metrics and dashboards
- support-bundle redaction tests
- secret source integration for production deployments
