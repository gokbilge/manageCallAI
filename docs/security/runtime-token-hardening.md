# Runtime Token Hardening

## Runtime Boundary

The runtime token authenticates FreeSWITCH-facing and adapter-facing runtime
endpoints. It is not a user credential, not an API key, and not a workflow token.
It must only be used by trusted runtime components over private network paths or
mutual-TLS edge routes.

Preferred transport:

- `Authorization: Bearer <RUNTIME_API_TOKEN>` for Go adapters and internal callers.
- HTTP Basic password for FreeSWITCH `mod_xml_curl` when Basic Auth is required.
- `x-managecallai-runtime-token` only for constrained adapters.

Deprecated transport:

- `runtime_token` query/body fallback. It is disabled by default in production and
  should be removed after live FreeSWITCH deployments no longer need it.

## Current Controls

- Production rejects default or weak runtime tokens.
- Runtime token fallback is disabled by default in production.
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
2. Deploy API accepting only the new token in a maintenance window, or add a
   short-lived dual-token transition if live calls require it.
3. Update Go adapter and FreeSWITCH profile secrets.
4. Restart runtime components.
5. Verify `/health`, directory lookup, call event ingest, and IVR runtime session
   creation.
6. Revoke the old token and scan logs/support bundles for accidental exposure.

## Follow-up Slice

`SLICE-46-runtime-secret-hardening.md` owns:

- complete removal of query/body fallback
- runtime auth failure metrics and alerts
- support-bundle redaction tests
- optional dual-token rotation window
- secret source integration for production deployments
