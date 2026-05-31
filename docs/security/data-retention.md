# Data Retention And Privacy

## Sensitive Data Classes

| Data | Sensitivity | Examples |
| --- | --- | --- |
| Call detail records | Personal data and operational metadata | caller, callee, timestamps, duration, disposition |
| Call events | Operational metadata, may include caller/callee data | call started, completed, failed |
| Recordings | High sensitivity media | call audio, voicemail audio |
| Transcripts and summaries | High sensitivity derived content | recording analysis output |
| Voicemail metadata | Personal data | mailbox, call id, duration, read/deleted state |
| Trunk credentials | Secret | SIP auth password ciphertext and key id |

## Default Retention Targets

These are product defaults to implement as configurable tenant policy.

- Call events: 180 days.
- CDRs: 365 days unless billing or legal requirements differ.
- Recordings: 30 days by default, configurable per tenant.
- Voicemail audio: 30 days after deletion or 90 days unread.
- Transcripts and summaries: match parent recording retention.
- Audit events: 7 years or customer compliance policy.
- Runtime health checks: 30 days.
- Webhook delivery logs: 90 days, with abandoned DLQ entries retained until
  dismissed or 180 days.

## Access Rules

- Tenant users only read their tenant's CDRs, recordings, voicemail, and transcripts.
- API keys must have explicit capabilities for recording and export access.
- MCP tools must not expose raw recording storage paths or bulk exports.
- Support bundles must redact secrets and avoid media payloads by default.
- Deletes should be soft-delete first when user recovery is expected, then hard
  purge via retention job.

## Purge Requirements

Retention purge jobs must:

- run tenant-scoped batches
- write audit events with counts, not raw media names
- delete derived transcript/summary data with the parent recording
- respect legal hold flags once implemented
- avoid deleting active voicemail or recording analysis jobs

## Follow-up Slice

`SLICE-47-recording-retention-privacy.md` owns:

- tenant retention policy table
- legal hold model
- purge worker
- export audit records
- recording/CDR/voicemail privacy integration tests
