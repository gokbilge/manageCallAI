# Recording, Voicemail, CDR, and Transcript Retention Policy

> **Status: Required before production.**
>
> The retention framework (policy document, DB schema, purge service, dry-run
> mode, and audit trail) is a hard production gate. Do not accept production
> traffic until all items in the Acceptance Criteria section below are
> satisfied and evidenced.

---

## Scope

This policy covers every user-identifiable or call-related data artifact
produced by the platform:

| Data type | Description |
|---|---|
| **Recordings** | Raw audio files captured for calls |
| **Voicemail audio** | Audio left by callers for subscribers |
| **Voicemail metadata** | Duration, caller-ID, timestamp, read/unread state |
| **CDRs** | Call Detail Records (start/end times, parties, disposition) |
| **Call events** | Per-call runtime events written by the FreeSWITCH agent |
| **Transcripts** | STT output attached to recordings or voicemails |
| **AI summaries** | LLM-generated call summaries |
| **Generated prompts / media** | Text-to-speech prompts stored per IVR version |
| **Automation webhook payloads** | Event payloads delivered to tenant webhook endpoints |

---

## Retention Defaults

These defaults apply unless a tenant-specific override is in effect (see below).

| Data type | Default retention | Minimum | Maximum |
|---|---|---|---|
| Recordings | 90 days | 1 day | 7 years |
| Voicemail audio | 90 days | 1 day | 7 years |
| Voicemail metadata | 365 days | 1 day | 7 years |
| CDRs | 365 days | 30 days | 7 years |
| Call events | 90 days | 7 days | 7 years |
| Transcripts | 90 days | 1 day | 7 years |
| AI summaries | 90 days | 1 day | 7 years |
| Generated prompts / media | 365 days | 30 days | 7 years |
| Webhook delivery logs | 30 days | 7 days | 365 days |

Retention clocks start from the **creation timestamp** of the record.
Recordings and voicemail audio retention clocks start from the call
end-time or voicemail-deposit-time, whichever is later.

---

## Tenant-Specific Retention Overrides

Tenant admins can manage their own retention policy via:

- `GET /api/v1/tenant/retention` — read current policy (null = defaults apply)
- `PATCH /api/v1/tenant/retention` — update per-category retention days

Overrides must stay within the minimum/maximum bounds above. All updates are audited.

Requires capability: `tenant.compliance.admin` (granted to `tenant_admin` role).

---

## Legal Hold

When a legal hold is placed on a tenant or a specific resource (e.g., a
call ID), all purge operations for the affected data are suspended regardless
of retention clock expiry.

Legal hold API:

- `POST /api/v1/tenant/legal-hold` — place a hold
- `DELETE /api/v1/tenant/legal-hold/{id}` — release a hold (audited)
- `GET /api/v1/tenant/legal-holds` — list active holds (`?all=true` for all)

Hold create and release are both audited to `tenant_audit_log`.

**Remaining before production:**

- Legal hold state must be surfaced in export and data-subject-request flows (see implementation status below).

---

## Deletion Job

A scheduled purge worker runs on a configurable interval (default: daily at
02:00 UTC) and permanently deletes records whose retention clock has expired
and which are not under a legal hold.

**Purge job requirements (required before production):**

1. **Tenant-scoped:** The purge job must operate per-tenant and respect
   per-tenant overrides.
2. **Dry-run mode:** The purge job must support `DRY_RUN=true` which logs
   what would be deleted without deleting it.
3. **Deletion audit trail:** Every deleted record must produce a deletion
   audit event (`resource_type`, `resource_id`, `tenant_id`, `deleted_at`,
   `retention_policy_days`, `actor=system`).
4. **Atomic per-record:** Partial failures must not leave records in an
   inconsistent state. Use DB transactions with storage object cleanup
   as a post-commit side-effect.
5. **Object storage cleanup:** Audio files (recordings, voicemail) stored in
   object storage must be deleted atomically with their DB records. Object
   storage deletion failures must be logged and retried.
6. **Export-before-delete:** If an operator has configured
   `export_before_delete=true` on a tenant, the purge job must export the
   record to the configured export sink before deletion.

---

## Implementation Status

> **Items marked "required before production" are NOT yet complete.**

| Item | Status |
|---|---|
| Retention policy DB schema (`tenant_retention_policies`) | ✅ Implemented — migration `0038_tenant_retention_policies.sql` |
| Retention policy schema expansion (voicemail, call events, summaries, generated media) | ✅ Implemented — migration `0043_retention_purge_expansion.sql` |
| Legal hold DB schema (`legal_hold_requests`) | ✅ Implemented — migration `0038_tenant_retention_policies.sql` |
| Scheduled purge worker with dry-run and audit trail | ✅ Implemented — `apps/worker/src/modules/retention/retention-purge.service.ts` |
| Per-tenant retention override API | ✅ Implemented — `GET/PATCH /api/v1/tenant/retention` with bounds validation and audit trail |
| Legal hold API (`POST`, `DELETE`, `GET`) | ✅ Implemented — `POST/DELETE/GET /api/v1/tenant/legal-hold(s)` with audit trail and cross-tenant isolation |
| Object storage audio file deletion | ⛔ **Required before production** — purge deletes DB records; object storage cleanup not implemented |
| Export-before-delete | ⛔ **Required before production** — not implemented |
| Integration tests covering purge, hold, dry-run | ✅ Implemented — `apps/api/src/modules/retention/retention.integration.test.ts` covers retention policy CRUD, legal hold lifecycle, cross-tenant isolation |
| Data-subject-request (DSR) / right-to-erasure flow | ⛔ **Required before production** — not documented or implemented |

---

## Backup Retention Interaction

Retention purge only removes records from the live database and object
storage. Backups are governed separately by the backup retention policy
(`docs/ops/backup-retention.md`). A record deleted from the live database
may still appear in backup snapshots taken before the deletion date.

Operators should document their backup retention strategy in relation to
legal hold and GDPR/CCPA obligations. If a data-subject request requires
deletion from backups, a backup purge procedure must be defined and executed.

---

## Acceptance Criteria (all required before production)

- [ ] `tenant_retention_overrides` table exists and is migrated.
- [ ] Per-tenant retention override API (`PATCH`, `GET`) implemented and
  integration-tested.
- [ ] Legal hold API (`POST`, `DELETE`, `GET`) implemented with audit log.
- [ ] Purge job supports dry-run mode (`DRY_RUN=true`).
- [ ] Purge job writes deletion audit events for every deleted record.
- [ ] Purge job respects legal hold (held records are never deleted).
- [ ] Object storage files are deleted atomically with DB records.
- [ ] Integration tests cover: normal purge, dry-run, legal hold bypass, export-before-delete.
- [ ] `pnpm test` passes with retention-purge tests included.

---

## Related

- `docs/ops/backup-retention.md` — backup snapshot retention and rehearsal
- `docs/ops/backup-retention-policy.json` — machine-readable backup retention policy
- `apps/worker/src/modules/retention/` — worker module scaffold
- GitHub issue: see issue tracker for "Implement retention API and legal hold endpoints" (production release blocker)
