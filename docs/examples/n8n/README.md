# n8n workflow templates

Ready-to-import workflow templates for integrating ManageCallAI with n8n.

## Prerequisites

1. A running n8n instance (self-hosted or cloud)
2. A ManageCallAI API key with the appropriate capabilities (see below)
3. The ManageCallAI webhook URL registered under **Automation → Webhooks** in the admin UI

## Importing a workflow

In n8n: **Workflows → New → Import from JSON** → paste or upload the `.json` file.

## Environment variables

Set these in n8n under **Settings → Environment Variables** (or pass them to the n8n container):

| Variable | Description | Required by |
|----------|-------------|-------------|
| `MANAGECALL_API_URL` | Base URL of the ManageCallAI API, e.g. `https://api.example.com` | all workflows |
| `MANAGECALL_WEBHOOK_SECRET` | `signing_secret` returned when the webhook was created | all workflows |
| `SLACK_WEBHOOK_URL` | Incoming Slack webhook URL | `ivr-flow-published`, `approval-review` |
| `ALERT_WEBHOOK_URL` | Alert endpoint (PagerDuty, Alertmanager, etc.) | `call-anomaly` |
| `ANOMALY_SHORT_CALL_SECONDS` | Threshold for short-call anomaly detection (default `5`) | `call-anomaly` |
| `COMPLIANCE_ENDPOINT_URL` | Compliance / case management endpoint | `recording-analysis` |
| `COMPLIANCE_KEYWORDS` | Comma-separated list of flagged phrases | `recording-analysis` |

## API key credentials

Each workflow uses an HTTP Header Auth credential named **ManageCallAI API Key**.
In n8n: **Credentials → New → Header Auth**
- Header name: `Authorization`
- Value: `Bearer <your-api-key>`

Required capabilities per workflow:

| Workflow | Required capability |
|----------|--------------------|
| `ivr-flow-published` | `tenant.ivr_flows.view` |
| `approval-review` | `tenant.approvals.view`, `tenant.approvals.decide` |
| `call-anomaly` | _(no API call — uses webhook payload only)_ |
| `recording-analysis` | `tenant.recordings.view` |

## Webhook signature verification

Every workflow includes a **Verify Signature** Code node that validates the
`X-ManageCall-Signature-256` header against the request body and timestamp.
Deliveries older than 5 minutes are rejected.

See `webhook-verification.js` for the full annotated verification function and
a standalone snippet you can paste directly into any Code node.

### Signature algorithm

```
secret = signing_secret (from webhook registration)
body   = raw JSON request body string
sig    = "sha256=" + HMAC-SHA256(secret, "${X-ManageCall-Timestamp}.${body}")
```

The computed `sig` must equal `X-ManageCall-Signature-256` (timing-safe comparison).
The absolute difference between `now` and `X-ManageCall-Timestamp` must be ≤ 300 seconds.

## Workflow files

| File | Trigger event | Purpose |
|------|--------------|---------|
| `ivr-flow-published.json` | `ivr_flow.published` | Notify Slack when a flow goes live |
| `approval-review.json` | `approval.requested` | Route approval requests to Slack with interactive buttons |
| `call-anomaly.json` | `call.completed` | Alert on anomalously short or failed calls |
| `recording-analysis.json` | `recording.analysis_completed` | Scan transcripts for compliance keywords |
