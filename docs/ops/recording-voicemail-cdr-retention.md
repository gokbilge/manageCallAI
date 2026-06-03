# Recording, Voicemail, CDR, and Transcript Retention Policy

> **Status: Required before production.**
>
> The retention framework (policy document, DB schema, purge service, dry-run
> mode, APIs, and audit trail) is implemented for database-backed resources.
> Production promotion still requires evidence for storage-object cleanup,
> export-before-delete, backup interaction, and operator signoff.

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
| Object storage audio file deletion | ✅ Implemented — `StorageBackend` abstraction + `LocalStorageBackend` wired into purge service; storage path collected before DB purge; failures counted in audit metadata |
| Export-before-delete | ✅ Decision recorded — explicitly deferred with risk acceptance (see above). No archival obligation confirmed for current operator. |
| Integration tests covering purge, hold, dry-run | ✅ Implemented — `apps/api/src/modules/retention/retention.integration.test.ts` covers retention policy CRUD, legal hold lifecycle, cross-tenant isolation; `apps/worker/src/modules/retention/retention-purge.service.test.ts` covers storage deletion, failure tolerance, audit metadata |
| Data-subject-request (DSR) / right-to-erasure flow | ✅ Documented — manual operator procedure defined (see above). Automated tooling deferred. |

---

## Object Storage File Deletion

When the retention purge job deletes a `call_recordings` or `voicemail_messages` DB record,
it also deletes the corresponding audio file from object storage.

**Deletion sequence (per record):**

1. Collect storage paths of eligible records (pre-flight query before DB purge).
2. Delete DB records (soft-delete for recordings, hard-delete for CDRs/events).
3. Delete storage files using the configured `StorageBackend`.
4. Log any storage deletion failures to the audit event `metadata_json.storage_delete_failures`.

**Failure behavior:** Storage deletion failures are non-fatal — the DB purge and
audit event are written regardless. A failed file deletion is counted in
`storage_delete_failures` in the audit row metadata and must be resolved by the
operator (re-run the purge, or manually delete the orphaned file).

**Storage backend:** The default backend (`LocalStorageBackend`) deletes files from the
local filesystem. `ENOENT` is treated as a success (file already gone). The
`StorageBackend` interface can be replaced with an S3/object-store implementation
without changing the purge service.

---

## Export-Before-Delete Decision

**Decision: Explicitly deferred — not implemented in this release.**

| Field | Value |
|---|---|
| Decision owner | Platform operator (release owner sign-off) |
| Risk | Audio files and CDRs are deleted without prior export to an external archive |
| Mitigation | Backup snapshots (see `docs/ops/backup-retention.md`) cover data until backup retention expires. Operators can restore from backup if a record is incorrectly purged. |
| Rollback | Restore individual records from backup snapshot if needed. |
| Scope accepted | All retention categories: recordings, voicemail audio, CDRs, call events, transcripts, AI summaries |
| Review trigger | Required when any tenant is subject to regulatory data archival obligations (e.g., MiFID II, SEC 17a-4) |

Export-before-delete (pre-deletion export to S3/GCS/SFTP archive) will be added
when operator archival requirements are confirmed. The `StorageBackend` abstraction
is designed to be extended to support this.

---

## Data Subject Request (DSR) / Right to Erasure

**Status: Documented. Operator action required for erasure requests.**

### What counts as personal data in this platform

| Data type | Personal data elements |
|---|---|
| Call recordings | Caller/callee voice, caller-ID, duration |
| Voicemail audio | Caller voice, caller-ID |
| CDRs | Caller-ID (ANI/DNIS), timestamps, disposition, session metadata |
| Transcripts | Caller utterances, named entities |
| AI summaries | Derived from caller utterances |
| Extension records | Display name, SIP username (linked to a person) |
| User accounts | Email, display name, role |

### Erasure request handling

1. **Receive** a DSR erasure request for a specific data subject (identified by
   caller-ID, extension number, or user account email).
2. **Place a legal hold** on any resource ID that must be preserved for
   litigation (if applicable). Skip this step if no litigation hold applies.
3. **Delete user account** via `DELETE /api/v1/users/{id}` — this produces an
   audit event and cascades to extension `owner_user_id` (set to NULL).
4. **Delete caller-identified records** by querying for CDRs, call events,
   recordings, and voicemail messages matching the caller-ID, then deleting them
   via the retention purge job triggered with a targeted scope, or by direct
   operator DB query with audit event.
5. **Delete transcripts and summaries** linked to the above recordings via the
   `recording_analysis_requests` table.
6. **Document** the erasure in the tenant audit log with:
   `action = 'dsr.erasure_completed'`, `metadata_json.subject_identifier`, and
   `metadata_json.categories_erased`.
7. **Verify** no personal data remains by re-querying on the subject identifier.

### Limitations and accepted risks

| Limitation | Accepted risk |
|---|---|
| Backup snapshots may contain personal data until the backup retention clock expires | Operator must disclose this in their privacy policy / DSAR response |
| Caller-ID in CDRs may appear on the counterpart tenant's records | Cross-tenant erasure is not automated — operator must coordinate |
| Third-party integrations (webhook endpoints, n8n workflows) may have cached data | Operator must notify downstream systems |

### Tooling

No automated DSR tool exists in this release. Erasure is a manual operator procedure
following the steps above. A DSR workflow will be added in a future release when
tenant count requires it.

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

- [x] `tenant_retention_policies` table exists and is migrated.
- [x] Per-tenant retention override API (`PATCH`, `GET`) implemented and
  integration-tested.
- [x] Legal hold API (`POST`, `DELETE`, `GET`) implemented with audit log.
- [x] Purge job supports dry-run mode.
- [x] Purge job writes deletion audit events for deleted database records.
- [x] Purge job respects legal hold (held records are never deleted).
- [x] Object storage files are deleted (or documented as accepted risk) when a retention record is purged — `LocalStorageBackend` implemented; failure-tolerant with audit metadata.
- [x] Export-before-delete decision recorded — explicitly deferred with risk acceptance by release owner (see Export-Before-Delete Decision section above).
- [x] Integration tests cover storage cleanup — `retention-purge.service.test.ts` covers storage deletion, failure counting, and audit trail.
- [x] Current release-candidate `pnpm test` passes with retention tests included.
- [x] DSR/right-to-erasure interaction documented and accepted — manual operator procedure defined (see Data Subject Request section above).

Policy documented; enforcement implementation/evidence required before production.

---

## Related

- `docs/ops/backup-retention.md` — backup snapshot retention and rehearsal
- `docs/ops/backup-retention-policy.json` — machine-readable backup retention policy
- `apps/worker/src/modules/retention/` — worker module scaffold
- GitHub issue: see issue tracker for "Implement retention API and legal hold endpoints" (production release blocker)
