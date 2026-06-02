# n8n Integration Setup Guide

manageCallAI supports n8n as an automation pathway via webhook triggers. This guide covers connecting n8n to a running manageCallAI stack and using the provided example workflows.

---

## Prerequisites

- A running manageCallAI stack (API accessible over HTTPS or localhost)
- A tenant admin account
- n8n instance (self-hosted or cloud)
- An API key with `automation.webhooks.manage` capability and the event capabilities for the workflows you want to run

---

## Step 1: Create an API Key

```http
POST /api/v1/automation/keys
Authorization: Bearer <tenant_admin_jwt>
Content-Type: application/json

{
  "name": "n8n Automation",
  "capabilities": ["tenant.automation.webhooks.manage", "tenant.automation.keys.view"]
}
```

Save the returned `raw_key` — it is not shown again.

---

## Step 2: Create a Webhook Endpoint

In manageCallAI, create a webhook pointing to your n8n webhook trigger URL:

```http
POST /api/v1/automation/webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "n8n Trigger",
  "url": "https://your-n8n.example.com/webhook/managecallai",
  "events": ["ivr_flow.published", "call.ended", "voicemail.received"]
}
```

Save the `signing_secret` from the response.

---

## Step 3: Configure n8n Credentials

In n8n, create a **Header Auth** credential:

| Field | Value |
|---|---|
| Name | `ManageCallAI Webhook Secret` |
| Header Name | `X-ManageCallAI-Signature` |
| Header Value | (leave empty — signature is validated by the Code node, not header auth) |

Create an **HTTP Request** credential if needed for API calls back to manageCallAI:

| Field | Value |
|---|---|
| Authentication | Header Auth |
| Header Name | `Authorization` |
| Header Value | `Bearer <raw_api_key>` |

---

## Step 4: Import Example Workflows

Example workflows are in `docs/examples/n8n/`. Import via the n8n UI:

1. Open n8n → **Workflows** → **Import from file**
2. Select the JSON file
3. Configure the credential nodes:
   - Set `MANAGECALLAI_BASE_URL` to your API base URL (e.g. `https://api.example.com`)
   - Set `MANAGECALLAI_WEBHOOK_SECRET` to the signing secret from Step 2
4. Activate the workflow

### Available example workflows

| File | Trigger | Purpose |
|---|---|---|
| `missed-call.json` | `call.ended` (unanswered) | CRM follow-up for missed calls |
| `voicemail-received.json` | `voicemail.received` | Create support ticket |
| `ivr-flow-published.json` | `ivr_flow.published` | Notify Slack on flow publish |
| `approval-review.json` | `approval.requested` | Interactive approval routing |
| `recording-transcribed.json` | `recording.transcribed` | Index transcript to search |
| `recording-analysis.json` | `recording.analysis_completed` | Compliance keyword scan |
| `route-rollback.json` | `ivr_flow.rolled_back` | Announce rollback via Slack |
| `ivr-publish-failed.json` | `ivr_flow.validation_failed` | Alert on IVR validation failure |
| `call-anomaly.json` | `call.ended` | Alert on short or failed calls |

---

## Step 5: Verify Signature in n8n

Each workflow includes a **Code** node that verifies the webhook signature. Set the `secret` variable to your signing secret:

```js
// From docs/examples/n8n/webhook-verification.js
const crypto = require('crypto');
const secret = 'your-signing-secret-here';
const body = $input.first().json.rawBody;
const timestamp = $input.first().headers['x-managecallai-timestamp'];
const signature = $input.first().headers['x-managecallai-signature'];

if (!timestamp || !signature) throw new Error('Missing signature headers');
if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) throw new Error('Timestamp out of window');

const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
if (signature !== expected) throw new Error('Invalid signature');
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Workflow not triggered | Webhook not subscribed to the event type | Add the event to your webhook subscription |
| Signature verification fails | Wrong signing secret | Rotate the secret and update n8n variable |
| 403 on API calls back to platform | API key missing required capability | Add capability to the API key |
| Old timestamp rejected | n8n processing delay > 5 minutes | Increase n8n execution timeout or reduce workflow complexity |

---

## Related

- `docs/design/webhooks.md` — Signing, replay protection, idempotency
- `docs/examples/n8n/` — Example workflow JSON files
- `docs/examples/n8n/webhook-verification.js` — Standalone signature verification
