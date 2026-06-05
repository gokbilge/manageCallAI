# End-User Self-Service

This guide is for phone users with the `end_user` role.

Use it after an administrator has already created your account, linked your
extension, and enabled any tenant policy flags your organization allows.

## 1. Sign in

1. Open the web app.
2. Sign in with your tenant slug, email, and password.
3. If your role is `end_user`, you land on `/tenant/me`.

This page is your self-service workspace. It does not expose tenant admin or
platform admin routes.

## 2. Review your extension

The top section shows:

- display name
- extension number
- SIP username
- current DND state

If you see a message saying no extension is linked to your account, your user
record exists but your extension is not assigned yet. An administrator must fix
that linkage.

## 3. Enable or disable DND

Use the **Do Not Disturb** card to:

- enable DND when you want incoming calls rejected
- disable DND when you want normal call delivery restored

Changes apply only to your own extension.

## 4. Set call forwarding

Use the **Call Forwarding** card to:

- enable forwarding
- enter a target extension or E.164 number
- save the change

If the page says the feature is disabled by your organization, your tenant admin
has turned off self-service forwarding.

## 5. Review device status

Use the **Devices** card to inspect recent SIP registration visibility for your
extension.

The page shows:

- registration status
- user agent, when available
- contact domain, when available
- last seen time

If this section is disabled, the tenant policy does not allow device visibility.

## 6. Review call history

Use the **Call History** section to inspect recent calls tied to your extension.

The page shows:

- direction
- counterpart number
- outcome
- last event or failure reason
- last seen time

This view is derived from normalized call events, not raw FreeSWITCH payloads.

## 7. Review voicemail

Use the **Voicemail Inbox** section to:

- review recent voicemail messages
- open playback in a separate tab
- mark unread messages as read
- delete messages you no longer need

If no mailbox exists for your extension yet, the list stays empty until an
administrator creates the corresponding voicemail box.

## 8. Reset your SIP password

Use the **SIP Credential** card to rotate your SIP device password.

Important behavior:

- the new password is shown once
- the API never re-shows it later
- update your phone or softphone immediately after reset

If the reset action is disabled, your organization does not allow self-service
credential rotation.

## 9. Common limits

- You cannot manage other users' extensions.
- You cannot see tenant admin routes like IVR, trunks, routes, or approvals.
- Your organization can disable voicemail, call history, device visibility, call
  forwarding, or SIP reset through tenant self-service policy.

## 10. Related guides

- [admin-tasks.md](admin-tasks.md)
- [../pbx/end-user-self-service.md](../pbx/end-user-self-service.md)
- [../ops/setup-guide.md](../ops/setup-guide.md)
