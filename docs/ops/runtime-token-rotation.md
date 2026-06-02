# Runtime Token Rotation

Zero-downtime rotation procedure for `RUNTIME_API_TOKEN`, the shared secret
that FreeSWITCH nodes and the FreeSWITCH agent use to authenticate runtime HTTP
requests to the manageCallAI API.

## How It Works

The API accepts two tokens simultaneously during a rotation window:

- `RUNTIME_API_TOKEN` — primary token (always checked first)
- `RUNTIME_API_TOKEN_SECONDARY` — secondary token (accepted only during rotation)

During rotation, both tokens are valid. Nodes are migrated one at a time from
the old token to the new one. Once all nodes are migrated, the rotation is
completed by promoting the secondary to primary and clearing the secondary.

This provides zero-downtime rotation for any number of FreeSWITCH nodes.

## Supported Auth Methods

The runtime token is accepted via:

| Method | Header / field | Notes |
|---|---|---|
| Bearer | `Authorization: Bearer <token>` | Preferred; use in production |
| Custom header | `X-ManageCallAI-Runtime-Token: <token>` | Supported |
| Basic auth | `Authorization: Basic base64(ignored:<token>)` | Supported for mod_xml_curl compatibility |
| Query/body | `runtime_token=<token>` | Only if `ALLOW_RUNTIME_TOKEN_FALLBACK=true`; disable in production |

In production, `ALLOW_RUNTIME_TOKEN_FALLBACK` must be `false`. Query and body
token fallback exposes the token in request logs and URLs.

## Rotation Procedure

### Step 1 — Generate a new token

```sh
openssl rand -hex 32
# → <new-token>
```

### Step 2 — Set the secondary token

Update the API deployment environment:

```sh
RUNTIME_API_TOKEN=<current-token>           # unchanged
RUNTIME_API_TOKEN_SECONDARY=<new-token>     # new value
```

Restart or reload the API. Both tokens are now accepted. Verify with
`pnpm check:runtime-token-rotation`.

### Step 3 — Migrate each FreeSWITCH node

For each FreeSWITCH node or freeswitch-agent instance:

1. Update `RUNTIME_API_TOKEN` in the node's environment to `<new-token>`.
2. Restart or reload the node.
3. Confirm the node makes a successful authenticated request (check API logs
   or `GET /health/ready` from the node host).

Repeat until all nodes are using the new token.

### Step 4 — Complete the rotation (promote secondary to primary)

Update the API deployment environment:

```sh
RUNTIME_API_TOKEN=<new-token>               # promoted from secondary
RUNTIME_API_TOKEN_SECONDARY=               # cleared (empty)
```

Restart or reload the API. Only the new token is now accepted. The old token
is rejected.

Verify with `pnpm check:runtime-token-rotation`.

### Step 5 — Confirm and document

```sh
pnpm production:preflight
pnpm check:runtime-token-rotation
```

Record the rotation date, operator, and environment in your operational log
or release evidence bundle.

## Audit Trail

Every failed runtime authentication attempt emits an audit event:

```json
{
  "action": "runtime.auth_failed",
  "resource_type": "runtime_endpoint",
  "metadata": {
    "auth_type": "bearer",
    "path": "/api/v1/freeswitch/directory",
    "source_ip": "10.0.0.5"
  }
}
```

The audit event does **not** include the submitted token value. Use increased
`auth_failed` event frequency to detect nodes still using the old token.

## Token Safety Rules

- Raw tokens are displayed once only: at generation time. They are never
  retrievable from the API or database.
- Tokens must not appear in application logs, error responses, or audit events.
- `ALLOW_RUNTIME_TOKEN_FALLBACK` must be `false` in production to prevent
  token leakage via query parameters or request bodies.
- Secondary token must always differ from the primary token.
- Minimum token length: 32 characters (64 hex chars from `openssl rand -hex 32`).

## Node-Scoped Token Rotation

For deployments using the node registry (`/api/v1/platform/nodes`), each
FreeSWITCH node has a node-scoped token stored per node record. Rotate node
tokens individually:

1. `POST /api/v1/platform/nodes/:id/rotate-token`
2. The response contains the new raw token once.
3. Update the node's deployment environment.
4. Restart the node.
5. Confirm authentication succeeds.

Node token rotation does not require API restart; it only affects that specific
node's authentication.

## Verify Rotation State

```sh
pnpm check:runtime-token-rotation
```

This checks:

- `RUNTIME_API_TOKEN` is set and meets minimum length
- If `RUNTIME_API_TOKEN_SECONDARY` is set, it is different from the primary
  and also meets minimum length (rotation is in progress)
- `ALLOW_RUNTIME_TOKEN_FALLBACK` is false in production

## File Rotation Rehearsal Evidence

Beta and production release gates require filed evidence from a real staging or
production-candidate rehearsal. Use the template at
`docs/ops/templates/rotation-rehearsal-evidence-template.json` and write the
filled artifact under ignored `artifacts/rotation/`:

```sh
cp docs/ops/templates/rotation-rehearsal-evidence-template.json \
  artifacts/rotation/rotation-rehearsal-$(date -u +%Y-%m-%dT%H-%M-%SZ).json

pnpm check:runtime-token-rotation -- \
  --evidence=artifacts/rotation/rotation-rehearsal-<timestamp>.json
```

The validator rejects evidence unless it confirms:

- old JWTs are rejected after JWT secret cutover
- old runtime tokens are rejected after primary token revocation
- the promoted runtime token is accepted
- runtime query/body token fallback is disabled in production
- JWT and runtime token rotation events are present in the audit log
- log-redaction evidence passed and is linked

Never place raw JWT secrets, runtime tokens, API keys, SIP credentials, or
database passwords in evidence JSON.

## Related Documents

- `docs/ops/secret-rotation.md` — rotation for all application secrets
- `docs/ops/runtime-edge-security.md` — runtime HTTP edge security model
- `docs/ops/production-preflight.md` — preflight gate
