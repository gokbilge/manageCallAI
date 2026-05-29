# n8n Automation Guide

n8n can drive the full IVR lifecycle using the automation API — no rotating JWTs required.

## 1. Create an API key

Issue a long-lived API key from any authenticated tenant session (UI or one-time curl):

```bash
curl -s -X POST "$API_BASE/api/v1/automation/keys" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "n8n-prod"}' | jq .data.key
```

The raw key (`mcak_<64hex>`) is returned **once**. Store it in n8n as a credential.

## 2. Configure n8n credentials

In n8n, create a **Generic Credential** (or HTTP Header Auth):

| Field  | Value                              |
|--------|------------------------------------|
| Name   | `Authorization`                    |
| Value  | `Bearer mcak_<your-key>`           |

Use this credential in every **HTTP Request** node.

## 3. IVR lifecycle workflow

### 3a. Create a draft flow

```
POST /api/v1/ivr-flows
Body: { "name": "Welcome Flow", "graph_json": { "nodes": [], "edges": [] } }
Response 201: { "data": { "id": "...", "draft_version_id": "..." } }
```

Store `flow_id` and `draft_version_id` in n8n workflow variables.

### 3b. Update the draft definition

```
PATCH /api/v1/ivr-flows/{flow_id}/versions/{version_id}
Body: { "graph_json": { ... } }
```

### 3c. Validate

```
POST /api/v1/ivr-flows/{flow_id}/validate
Response 200: validation passed → proceed
Response 422: validation failed → check data.outcome.errors, fix, retry
```

### 3d. Simulate

```
POST /api/v1/ivr-flows/{flow_id}/simulate
Body: { "caller_number": "+14155550001", "digits": ["1"] }
Response 200: simulation passed → proceed
Response 422: simulation failed → inspect data.outcome
```

### 3e. Request publish

```
POST /api/v1/ivr-flows/{flow_id}/versions/{version_id}/publish
Response 200: { "data": { "status": "published", ... } }
Response 202: { "data": { "status": "pending_approval", "approval_request_id": "..." } }
```

If `202`, the flow awaits approval — see Section 5.

## 4. Register a webhook for event notifications

n8n has a built-in **Webhook** node. Point it at your n8n instance and register it with manageCallAI:

```bash
curl -s -X POST "$API_BASE/api/v1/automation/webhooks" \
  -H "Authorization: Bearer mcak_<key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "n8n-events",
    "url": "https://n8n.example.com/webhook/managecall",
    "events": ["ivr_flow.published", "ivr_flow.publish_pending", "approval.approved", "approval.rejected"]
  }'
```

The response includes `signing_secret`. Use it to verify incoming webhooks (see Section 6).

## 5. Available webhook events

| Event                        | Trigger                                              |
|------------------------------|------------------------------------------------------|
| `ivr_flow.published`         | A flow version was published immediately             |
| `ivr_flow.publish_pending`   | Publish submitted, waiting for approval              |
| `ivr_flow.rollback_completed`| A rollback completed                                 |
| `approval.approved`          | An approval request was approved                     |
| `approval.rejected`          | An approval request was rejected                     |

### Payload shape

```json
{
  "event": "ivr_flow.published",
  "tenant_id": "...",
  "data": { "flow_id": "...", "version_id": "..." },
  "timestamp": "2026-05-28T01:00:00.000Z"
}
```

## 6. Verifying webhook signatures

Each delivery includes `X-ManageCall-Signature: sha256=<hex>`.

In n8n, use a **Code** node:

```js
const crypto = require('crypto');
const secret = $credentials.signingSecret;
const body   = JSON.stringify($input.first().json);
const sig    = crypto.createHmac('sha256', secret).update(body).digest('hex');
if (`sha256=${sig}` !== $input.first().headers['x-managecall-signature']) {
  throw new Error('Invalid webhook signature');
}
return $input.all();
```

## 7. Security boundaries

- API keys carry `tenant_admin` permissions — they **cannot** bypass the approval policy.
  A publish that requires approval always returns `202 pending_approval`, regardless of caller identity.
- API keys are scoped to a single tenant; they cannot access other tenants' data.
- Revoke keys immediately if compromised: `DELETE /api/v1/automation/keys/{id}`.

## 8. Approval workflow (n8n example)

Use this pattern when a publish returns `202 pending_approval` and you want n8n to notify a Slack channel then poll for a human decision.

**Trigger**: Webhook node receives `ivr_flow.publish_pending` event.

**Step 1 — Fetch approval details** (HTTP Request):
```
GET /api/v1/approvals/{approval_request_id}
```
Extract `flow_name` and `requested_by` from the response.

**Step 2 — Notify Slack** (Slack node):
```
Post to #flow-approvals: "New approval request for {{flow_name}} by {{requested_by}}. Approve at: {{your-ui-url}}/tenant/approvals"
```

**Step 3 — Wait** (Wait node, e.g. 24 hours):
After waiting, or triggered by a manual n8n webhook from your approval UI.

**Step 4 — Check approval status** (HTTP Request):
```
GET /api/v1/approvals/{approval_request_id}
```
Branch on `data.status`: `approved` → continue, `rejected` / `expired` → notify and stop.

**Step 5 — Handle result** (Switch node):
- `approved`: Send a confirmation Slack message.
- `rejected`: Alert the flow author with the rejection reason.

---

## 9. Failed-call debug workflow (n8n example)

Use this pattern to automatically investigate failed call events and produce a debug report.

**Trigger**: Webhook node receives `call.failed` or `ivr_session.failed` event.

**Step 1 — Fetch call events** (HTTP Request):
```
GET /api/v1/call-events?call_id={{call_id}}
```
This returns ordered events for the call.

**Step 2 — Fetch session replay** (HTTP Request, if IVR call):
```
GET /api/v1/runtime/ivr/sessions?call_id={{call_id}}
```
Pick the first session, then:
```
GET /api/v1/runtime/ivr/sessions/{session_id}
```
The replay includes every node step, collected digits, branch decisions, and failure nodes.

**Step 3 — Fetch recordings** (HTTP Request, if voicemail/recording exists):
```
GET /api/v1/recordings?call_id={{call_id}}
```

**Step 4 — Compose report** (Code node):
```js
const events  = $node["Fetch call events"].json.data;
const replay  = $node["Fetch session replay"].json.data;
const summary = {
  call_id:      events[0]?.call_id,
  event_count:  events.length,
  session_steps: replay?.steps?.length ?? 0,
  last_event:   events[events.length - 1]?.event_type,
  failed_at:    replay?.steps?.find(s => s.status === 'failed')?.node_id,
};
return [{ json: summary }];
```

**Step 5 — Send report** (Slack or Email node):
Post the summary to a `#call-failures` channel or email the on-call engineer.
