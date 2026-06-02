# Data Retention Policy

This policy defines production retention behavior for tenant telecom data. It is
implemented by the worker retention purge job and tenant retention policy rows in
PostgreSQL.

## Data Categories

| Category | Default platform retention | Tenant override column | Purge behavior |
| --- | ---: | --- | --- |
| Call recordings | 365 days | `recording_retention_days` | Soft-delete `call_recordings`; media deletion is handled by storage lifecycle using `deleted_at`. |
| Voicemail audio and metadata | 365 days | `voicemail_retention_days` | Soft-delete `voicemail_messages` by setting `deleted_at`. |
| Recording transcripts | 180 days | `transcript_retention_days` | Redact `recording_analysis_requests.transcript_text`. |
| AI summaries | 180 days | `ai_summary_retention_days` | Redact `recording_analysis_requests.summary_text`. |
| CDRs | 730 days | `cdr_retention_days` | Delete eligible `call_detail_records`. |
| Call events | 365 days | `call_event_retention_days` | Delete eligible `call_events`. |
| Generated media | 180 days | `generated_media_retention_days` | Clear `prompt_generation_requests.media_reference`. |

Prompt assets, user accounts, tenants, audit logs, and published telecom
configuration are not purged by this job. Those objects require explicit
business workflows because deleting them can change live call behavior or remove
release evidence.

## Tenant Overrides

If a tenant has no row in `tenant_retention_policies`, the platform defaults
above apply. If a tenant policy row exists, each non-null column overrides the
platform default for that category.

A null value in a tenant policy row means indefinite retention for that category.
Use indefinite retention only when legal or contractual requirements require it.

Tenant admins with `tenant.compliance.admin` can manage retention policy and
legal holds through the compliance API/UI.

## Legal Holds

Active rows in `legal_hold_requests` block purging. Supported hold categories:

- `recording`
- `voicemail`
- `transcript`
- `summary`
- `cdr`
- `call_event`
- `generated_media`
- `all`

`resource_id = NULL` holds every resource in that category for the tenant.
For call-linked records, `resource_id` may be the row ID or the `call_id`.
Released or expired holds do not block the purge job.

## Running the Purge Job

The purge job lives in the worker package and requires `DATABASE_URL`.

Dry-run first:

```bash
pnpm --filter @managecallai/worker retention:purge -- --dry-run --json
```

Execute purge:

```bash
pnpm --filter @managecallai/worker retention:purge -- --json
```

The job is safe to schedule periodically. Recommended production cadence is once
per day during a low-traffic maintenance window. For multi-instance worker
deployments, run this job as a singleton scheduled task.

## Audit Trail

Each non-empty deletion batch writes one `tenant_audit_log` row:

- `action`: `retention.purge`
- `actor_role`: `system`
- `actor_id`: `worker:retention-purge` by default
- `resource_type`: retention category
- `metadata_json.record_count`
- `metadata_json.cutoff`
- `metadata_json.retention_days`

Dry-runs do not write audit rows because no deletion occurred.

## Export Before Delete

Before reducing a tenant's retention period or releasing a legal hold, operators
must export required evidence:

1. Export CDRs and audit records through the tenant export workflow.
2. Export recording metadata and any required recording media from the configured
   recording storage root.
3. Export voicemail metadata/media when the legal or customer request covers
   voicemail.
4. Store the export manifest with the release evidence bundle.

Production releases must keep export evidence outside the application database so
that retention purges cannot remove the compliance proof itself.

## Verification

Required checks after schema changes:

```bash
pnpm db:migrate
pnpm db:contracts
pnpm db:constraints
pnpm --filter @managecallai/worker test
```

Required behavior:

- Held records are not counted or deleted while an active hold exists.
- Released records become eligible on the next purge run.
- Dry-run returns counts without changing rows or writing audit events.
- Real purge writes audit rows for every category with deleted records.
