-- Audit table unification.
--
-- Background: the codebase has two parallel audit tables:
--   • audit_events      (0001) — domain lifecycle events written by repositories
--   • tenant_audit_log  (0019) — API-layer events written by controllers
--
-- This migration merges history into tenant_audit_log and renames audit_events to
-- audit_events_archive so application code has a single authoritative audit table.
-- The application code switch (repositories writing to tenant_audit_log) deploys
-- alongside this migration.

-- ── 1. Backfill audit_events rows into tenant_audit_log ──────────────────────
-- Column mapping:
--   audit_events.actor_type  → tenant_audit_log.actor_type   (new column from 0037)
--   audit_events.actor_id    → tenant_audit_log.actor_id
--   audit_events.action      → tenant_audit_log.action        (prefixed below)
--   audit_events.object_type → tenant_audit_log.resource_type
--   audit_events.object_id   → tenant_audit_log.resource_id   (cast to text)
--
-- Action string mapping: audit_events used bare verbs ('publish', 'rollback');
-- tenant_audit_log uses domain-qualified strings ('ivr_flow.published').
-- Rows that don't match the mapping are imported as-is with 'domain.' prefix.

-- tenant_audit_log has DO INSTEAD NOTHING rules for UPDATE/DELETE (0028) which
-- makes ON CONFLICT DO NOTHING incompatible with the table. Use WHERE NOT EXISTS
-- for deduplication instead.
INSERT INTO tenant_audit_log
    (tenant_id, actor_id, actor_type, action, resource_type, resource_id, created_at)
SELECT
    ae.tenant_id,
    ae.actor_id::uuid,
    ae.actor_type,
    CASE ae.action
        WHEN 'publish'  THEN 'ivr_flow.published'
        WHEN 'rollback' THEN 'ivr_flow.rollback'
        WHEN 'approve'  THEN 'approval.approved'
        WHEN 'reject'   THEN 'approval.rejected'
        ELSE 'domain.' || ae.action
    END AS action,
    ae.object_type  AS resource_type,
    ae.object_id::text AS resource_id,
    ae.created_at
FROM audit_events ae
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_audit_log tal
     WHERE tal.tenant_id    = ae.tenant_id
       AND tal.resource_type = ae.object_type
       AND tal.resource_id   = ae.object_id::text
       AND tal.created_at    = ae.created_at
);

-- ── 2. Rename audit_events to archive ────────────────────────────────────────
-- The DO INSTEAD NOTHING immutability rules from 0028 stay attached to the
-- renamed table — they reference the OID, not the name, so no re-creation needed.
--
-- After this rename, any code still writing to audit_events will fail with
-- "relation audit_events does not exist". Validate application code has been
-- updated before applying in a production environment.

ALTER TABLE IF EXISTS audit_events RENAME TO audit_events_archive;

COMMENT ON TABLE audit_events_archive IS
    'Read-only historical archive of domain audit events written before 0038. '
    'All new audit writes go to tenant_audit_log. Do not write to this table.';

-- Rename the existing index so it does not collide if audit_events is ever recreated.
ALTER INDEX IF EXISTS audit_events_actor_idx
    RENAME TO audit_events_archive_actor_idx;
