# Push Notification Integration — Guidance and Delivery Plan

**Status:** scaffolded — token registration API is available; actual push delivery is a future work item.

---

## Why

manageCallAI does not currently ship a native mobile client. However, the
platform must define its push notification integration story now so that:

- Future native or PWA clients can integrate without API rework.
- Token handling, tenant scoping, and security practices are decided up front.
- Third-party integrators building on the MCP or webhook surface understand
  what is supported versus what is planned.

---

## What is supported today

| Capability | Status |
|---|---|
| Token registration (`POST /api/v1/me/push-tokens`) | Available |
| Token revocation (`DELETE /api/v1/me/push-tokens/:platform`) | Available |
| Tenant-scoped token storage | Available |
| Inbound call ringing via SIP client (Zoiper, Linphone, etc.) | Available |
| Voicemail new-message notification via polling / portal | Available |
| Actual push delivery to APNs / FCM | **Not yet implemented** |
| Web Push (VAPID) delivery | **Not yet implemented** |

---

## Supported platforms (token schema)

Tokens are stored per-user, per-platform. Supported `platform` values:

| Value | Description |
|---|---|
| `apns` | Apple Push Notification service (iOS / macOS) |
| `fcm` | Firebase Cloud Messaging (Android / cross-platform) |
| `web` | Web Push via VAPID (browsers) |

---

## Token registration API

### Register a token

```
POST /api/v1/me/push-tokens
Content-Type: application/json

{
  "platform": "fcm",
  "token": "<device-token>"
}
```

Response `200`:
```json
{ "data": { "user_id": "...", "platform": "fcm", "updated_at": "..." } }
```

The endpoint is idempotent — posting the same token twice updates the
`updated_at` timestamp. Posting a new token for the same platform replaces
the previous one (one active token per platform per user).

### Revoke a token

```
DELETE /api/v1/me/push-tokens/:platform
```

Removes the stored token for the specified platform. Returns `204 No Content`.

---

## Security and token handling

- Tokens are stored per-user and tenant-scoped — one row per `(user_id, platform)`.
- Tokens are **not** considered secrets equivalent to SIP passwords, but they
  should be rotated on user logout or device de-provision.
- The registration endpoint requires a valid end-user session (JWT with
  `end_user` or higher role).
- **No raw token is returned** after registration; the response only confirms
  the record timestamp. Callers must retain the token themselves.
- Tokens expire on the push provider side (APNs / FCM) — stale tokens are
  silently dropped. Future delivery implementation should handle feedback
  channels to remove invalid tokens.
- Web Push VAPID keys (application server keys) must be generated separately
  and stored in tenant or platform config. They are not part of this schema.

---

## Architecture for future delivery

When push delivery is implemented, the recommended architecture is:

```
Event emitter (API / worker)
  └─► push-notification worker job
        ├─► look up active tokens for user (SELECT from push_notification_tokens)
        ├─► APNs (HTTP/2 provider API)
        ├─► FCM (v1 API / HTTP)
        └─► Web Push (web-push library, VAPID signed)
```

Delivery should be:
- **Asynchronous** — never block the call path on push delivery.
- **Best-effort** — a failed push must not surface as an error to the API
  caller or FreeSWITCH agent.
- **Feedback-aware** — APNs and FCM return invalidity signals; expired tokens
  should be removed automatically.

---

## Events that will trigger push notifications (planned)

| Event | Payload (planned) |
|---|---|
| Inbound call ringing | caller ID, extension |
| Voicemail received | duration, mailbox |
| Missed call | counterpart number |
| DND status changed by admin | new state |

---

## Current support vs future work

| Item | Now | Future |
|---|---|---|
| Token storage API | ✅ | — |
| Ringing / call notification | Via SIP client | Native push via APNs/FCM |
| Voicemail notification | Portal polling | Push with payload |
| Missed call | Call history page | Push with payload |
| VAPID key management | Not built | Per-tenant config |
| Feedback channel handling | Not built | Automated token cleanup |
| Native iOS/Android client | Not built | Separate product work |
