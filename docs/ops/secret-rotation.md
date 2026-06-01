# Application Secret Rotation

Rotation procedures for application secrets in manageCallAI. Rotate any secret
that may have been exposed or on a regular schedule (recommended: every 90 days
for tokens, every 365 days for encryption keys with version tracking).

## Secret Inventory

| Secret | Env var | Rotation method | Downtime required |
|---|---|---|---|
| JWT signing key | `JWT_SECRET` | Rolling restart | Brief (active sessions expire) |
| SIP encryption master key | `SIP_SECRET_MASTER_KEY` | Key versioning via `SIP_SECRET_KEY_ID` | None |
| Runtime API token | `RUNTIME_API_TOKEN` | Secondary token rotation (zero-downtime) | None |
| FreeSWITCH ESL password | `FREESWITCH_ESL_PASSWORD` | Config + agent restart | Brief |
| Webhook signing secrets | Per-webhook in the database | API rotation endpoint | None |
| Automation API keys | Per-key in the database | New key + grace period | None |
| Redis rate-limit URL credentials | `RATE_LIMIT_REDIS_URL` | Credential rotation + restart | Brief |

## JWT_SECRET Rotation

JWT_SECRET signs all user session tokens. Rotating it invalidates all active
sessions immediately. Plan for forced re-login.

1. Generate a new secret: `openssl rand -hex 32`
2. Update `JWT_SECRET` in the deployment environment.
3. Restart the API. Active sessions are invalidated. Users must log in again.
4. If gradual rollout is required: run two API instances briefly, old with old
   secret, new with new secret, behind a load balancer. Once old instance is
   drained, shut it down.

There is no secondary-key mode for JWT. Session invalidation is intentional.

## SIP_SECRET_MASTER_KEY Rotation

The SIP master key encrypts SIP passwords stored in the `extensions` and
`sip_trunks` tables. The `sip_password_key_id` column records which key version
was used for each row.

Key rotation does not require SIP credential re-entry but does require a
migration step:

1. Generate a new key: `openssl rand -hex 32`
2. Choose a new key ID, e.g. `v2`.
3. Deploy with the old key still active and the new key available in the
   key store (if using an external secrets manager).
4. Run the re-encryption migration:
   - Read each row with `sip_password_key_id = 'v1'`.
   - Decrypt the ciphertext with the v1 key.
   - Re-encrypt with the v2 key.
   - Update `sip_password_ciphertext` and `sip_password_key_id = 'v2'`.
5. Update `SIP_SECRET_MASTER_KEY` to the new key and `SIP_SECRET_KEY_ID` to `v2`.
6. Restart the API.
7. Verify that SIP authentication still works with a test call or registration.
8. Retire the v1 key from the key store.

If restoring from a backup taken before the rotation, ensure the old key version
is still available. The `sip_password_key_id` column identifies which key to use.

## FreeSWITCH ESL Password Rotation

1. Choose a new strong password: `openssl rand -hex 16`
2. Update `FREESWITCH_ESL_PASSWORD` in the deployment environment.
3. Update `event_socket.conf.xml` with the new password.
4. Restart FreeSWITCH: `fs_cli -x "shutdown restart"`
5. Restart the FreeSWITCH agent (it reads `FREESWITCH_ESL_PASSWORD` from env).
6. Verify the agent reconnects to ESL successfully.

## Webhook Signing Secret Rotation

Each automation webhook has a unique signing secret. Rotate per-webhook via
the API without restarting the API service.

```sh
# Rotate the signing secret for a webhook
PATCH /api/v1/automation/webhooks/:id/rotate-secret
Authorization: Bearer <operator-jwt>
```

The response contains the new raw secret once. Store it immediately; it is not
retrievable again. Update the receiving endpoint to accept the new signature
before decommissioning the old secret.

If the API does not yet expose `/rotate-secret`, re-create the webhook with a
new secret and update the receiving endpoint.

## Automation API Key Rotation

1. Create a new API key via `POST /api/v1/automation/keys` with the same
   capabilities as the key being rotated.
2. Distribute the new key to all automation consumers.
3. After the transition window, deactivate the old key:
   `DELETE /api/v1/automation/keys/:id`

Never log API keys. The creation endpoint returns the raw key once; it is
stored hashed in the database.

## Runtime Token Rotation

See `docs/ops/runtime-token-rotation.md` for the zero-downtime rotation
procedure using `RUNTIME_API_TOKEN_SECONDARY`.

## Post-Rotation Verification

After any secret rotation:

```sh
pnpm production:preflight       # confirms new values are valid
pnpm check:runtime-token-rotation  # confirms token rotation state is consistent
```

For SIP key rotation: verify SIP registrations and a test call to confirm
decryption works with the new key.

## Related Documents

- `docs/ops/runtime-token-rotation.md` — zero-downtime runtime token rotation
- `docs/ops/production-preflight.md` — preflight gate
- `docs/ops/backup-restore.md` — restore from backup after key rotation
