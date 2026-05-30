# Telecom Threat Model

## Scope

This threat model covers manageCallAI as a telecom control plane over stock FreeSWITCH.
The API owns desired state, authorization, validation, publish, audit, observability,
and rollback. FreeSWITCH, Lua, and the Go agent are runtime executors only.

## Assets

- SIP trunk credentials and route policy
- Runtime API token and FreeSWITCH directory lookup paths
- Tenant call routing, IVR graphs, prompts, schedules, queues, and extensions
- Call detail records, call events, recordings, voicemail, and transcripts
- Automation API keys, webhook signing secrets, MCP credentials, and audit records
- Runtime health and operational telemetry

## Primary Threats

| Threat | Attack Path | Existing Controls | Required Follow-up |
| --- | --- | --- | --- |
| SIP scanning and registration abuse | Internet scanners enumerate SIP usernames or brute-force endpoints. | Directory lookup is API-backed and tenant-scoped; runtime routes require runtime token; registration events are stored. | Add edge SIP rate limits, failed-registration alert rules, and lockout policy. |
| Toll fraud | Compromised extension or automation key initiates high-cost outbound calls. | Emergency/premium prefixes blocked; route allow/block prefixes; per-route call cap; outbound endpoint rate limit. | Add tenant-level policy table, country and area-code UI, spend/attempt budgets, and alerting. |
| Trunk credential leakage | Secrets appear in logs, responses, support bundles, or backups. | SIP passwords are encrypted; API responses omit ciphertext and plaintext. | Add credential rotation runbook and support-bundle secret scan gate. |
| Runtime token leakage | Token appears in query params, logs, browser history, or support bundles. | Production disables fallback by default; runtime token must be strong. Request completion logs redact token-like query params. | Remove fallback entirely after migration and add runtime auth failure alerting. |
| Tenant isolation failure | Cross-tenant reads, runtime events, or automation keys access another tenant. | Route handlers and repos use tenant_id predicates; API key capabilities are scoped. | Expand tenant-isolation integration tests around automation, recordings, and observability. |
| MCP/AI abuse | AI tool calls bypass lifecycle or expose raw runtime control. | MCP is narrower than REST and schema drift is checked. | Add MCP action audit trail and explicit tool risk reviews for new tools. |
| n8n/webhook replay | Captured webhook payload is replayed into a workflow. | Webhook deliveries include timestamp, event id, and HMAC signature helpers. | Standardize on `X-ManageCallAI-*` headers and add replay cache examples/tests. |
| FreeSWITCH XML injection | User-controlled data reaches generated XML without escaping. | XML generation is isolated and golden-tested. | Add fuzz tests for prompts, domains, extension names, and caller ID fields. |
| Recording/CDR/voicemail privacy | Sensitive media or metadata is retained too long or overexposed. | Tenant-scoped APIs; recordings are business objects. | Add retention jobs, export audit, legal hold, and per-tenant retention settings. |

## Abuse Alert Rules

Implement alerts as business-level events, not raw FreeSWITCH payload dumps.

- Repeated failed registrations: same tenant, extension, source IP, or user agent exceeds threshold in 5 minutes.
- Outbound burst: outbound attempts exceed tenant baseline, route cap, or trunk cap.
- Unknown destination attempts: outbound calls fail because no active route or allowlist match.
- Runtime auth failures: runtime token failures by source IP or endpoint exceed threshold.
- Webhook replay attempts: duplicate event id or stale timestamp is observed by first-party webhook receiver examples.
- Trunk degradation: runtime health or delivery failure rate crosses threshold.
- Recording backlog: queued or failed analysis requests exceed threshold or age.

## Implementation Slices

- `SLICE-45-telecom-fraud-policy.md`: tenant/trunk outbound policy model and alerting.
- `SLICE-46-runtime-secret-hardening.md`: runtime token removal path, redaction gates, and auth-failure alerts.
- `SLICE-47-recording-retention-privacy.md`: retention, legal hold, purge, and export audit.
- `SLICE-48-security-alert-rules.md`: alert rules for registrations, runtime auth, webhooks, and outbound abuse.

## Review Checklist

- Does the change expose raw ESL, raw XML, SIP passwords, runtime tokens, or provider secrets?
- Does every runtime, automation, MCP, and UI path use tenant-scoped API operations?
- Does every outbound path run global blocks before route selection and route policy before persistence?
- Does every business event have a bounded payload and audit/trace correlation?
- Can operators detect abuse without reading raw runtime payloads?
