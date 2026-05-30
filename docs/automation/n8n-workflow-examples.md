# n8n Workflow Examples

Webhook integration with manageCallAI uses the standard Automation Webhooks API.
Each workflow subscribes to one or more business events from the event catalog.

## Setup: creating a webhook subscription

```http
POST /api/v1/automation/webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "n8n-missed-call-handler",
  "url": "https://your-n8n.example.com/webhook/managecallai",
  "events": ["call.completed", "voicemail.recording_available"]
}
```

Response includes `signing_secret`. Store it in n8n credentials; use it to verify
the `X-ManageCall-Signature` header on every delivery.

## Signature verification in n8n

Add a **Function** node after the Webhook trigger:

```javascript
const crypto = require('crypto');
const secret = $credentials.managecallaiSigningSecret;
const payload = $input.first().json.body; // raw body string
const sig = $input.first().headers['x-managecall-signature'];
const expected = 'sha256=' + crypto.createHmac('sha256', secret)
  .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
  .digest('hex');
if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
  throw new Error('Signature mismatch — delivery rejected');
}
return $input.all();
```

## De-duplication using event_id

Every delivery includes `Webhook-Event-Id` in the HTTP headers. Use it to de-duplicate
in n8n with a **Set** node that writes the event_id to a Redis or PostgreSQL store,
and a **Filter** node that skips if already processed.

## Workflow: missed call → send notification

**Trigger events:** `call.completed`

**Logic:**
1. Check `data.final_disposition` — if `voicemail` or no disposition, it's a missed call.
2. Look up the extension that was the destination (`data.to_number`).
3. POST to your notification channel (Slack, email, SMS) with caller details.

**n8n workflow sketch:**
```
Webhook → Verify Signature → Switch (final_disposition)
  case "voicemail" → HTTP Request (notify team)
  case null       → HTTP Request (notify team)
  default         → No-op
```

## Workflow: voicemail received → transcribe and route

**Trigger events:** `voicemail.recording_available`

**Logic:**
1. Receive the event with `voicemail_box_id` and `call_id`.
2. Request recording analysis: `POST /api/v1/recording-analysis` with `requested_outputs: ["transcript"]`.
3. When `recording.analysis_completed` fires, read the transcript.
4. Use an AI node to classify the voicemail topic and route to the right team.

## Workflow: IVR publish failed → alert

**Trigger events:** `ivr_flow.validation_failed`

**Logic:**
1. Parse `data.errors` array.
2. Format a Slack message listing each error field and message.
3. Post to the IVR team channel.

## Workflow: route rollback → announce

**Trigger events:** `ivr_flow.rollback_completed`

**Logic:**
1. Receive rollback event with `flow_id`.
2. Fetch the flow details: `GET /api/v1/ivr-flows/:flow_id`.
3. Post a message to ops Slack with flow name and the new active version.

## Workflow: recording transcribed → store and index

**Trigger events:** `recording.analysis_completed`

**Logic:**
1. Receive with `recording_id`, `transcript_text`.
2. Write to an external search index (Elasticsearch, Typesense).
3. Optionally summarize with an AI node and write to a CRM.

## Official n8n node package

An installable n8n community node (`n8n-nodes-managecallai`) is planned.
Until it is published, use the standard **HTTP Request** and **Webhook** nodes as
shown above with the API key in an HTTP Header credential.
