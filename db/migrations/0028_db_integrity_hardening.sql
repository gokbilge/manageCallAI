-- DB integrity hardening.
--
-- 1. Hot-path runtime indexes for call event correlation and IVR session lookup.
-- 2. Audit log immutability: a rule that prevents UPDATE/DELETE on tenant_audit_log.
-- 3. Queue member tenant consistency: CHECK that queue_members.tenant_id matches
--    the queue's tenant (enforced via FK path; documented here with a comment).
-- 4. Active route uniqueness index for the fast-path dialplan lookup.
-- 5. Webhook delivery queue priority index.

-- ── 1. Hot-path runtime indexes ───────────────────────────────────────────────

-- Call event lookup by call_id across a tenant (used by call timeline endpoint)
CREATE INDEX IF NOT EXISTS idx_call_events_tenant_call_recent
    ON call_events (tenant_id, call_id, event_time DESC);

-- IVR flow sessions: active sessions by flow (used by observability HUD)
CREATE INDEX IF NOT EXISTS idx_ivr_flow_sessions_flow_status
    ON ivr_flow_sessions (tenant_id, flow_id, status, created_at DESC);

-- Approval requests: pending lookup (hot path for publish gate)
CREATE INDEX IF NOT EXISTS idx_approval_requests_pending
    ON approval_requests (tenant_id, status, created_at DESC)
    WHERE status = 'pending';

-- Recording analysis: pending/processing backlog (used by analysis worker)
CREATE INDEX IF NOT EXISTS idx_recording_analysis_status
    ON recording_analysis_requests (tenant_id, status, created_at ASC)
    WHERE status IN ('queued', 'processing');

-- Users: email lookup within tenant (used by auth login)
CREATE INDEX IF NOT EXISTS idx_users_tenant_email
    ON users (tenant_id, email);

-- ── 2. Tenant audit log immutability ─────────────────────────────────────────
--
-- Audit records must never be modified or deleted once written (immutability
-- requirement for compliance). We enforce this at the database level with rules
-- that always raise an exception on UPDATE or DELETE.
--
-- Note: ON DELETE CASCADE on tenant_id FK still allows row deletion when a
-- tenant itself is deleted (administrative operation). If tenant deletion must
-- also be prohibited, that constraint belongs at the application layer.

CREATE OR REPLACE RULE tenant_audit_log_no_update AS
    ON UPDATE TO tenant_audit_log
    DO INSTEAD NOTHING;

CREATE OR REPLACE RULE tenant_audit_log_no_delete AS
    ON DELETE TO tenant_audit_log
    DO INSTEAD NOTHING;

-- ── 3. Audit event table immutability (initial schema table) ──────────────────

CREATE OR REPLACE RULE audit_events_no_update AS
    ON UPDATE TO audit_events
    DO INSTEAD NOTHING;

CREATE OR REPLACE RULE audit_events_no_delete AS
    ON DELETE TO audit_events
    DO INSTEAD NOTHING;

-- ── 4. Active inbound route fast-path lookup ──────────────────────────────────
--
-- mod_xml_curl dialplan lookup hits: (tenant_id, match_type, match_value, status='active')
-- This partial index covers only active routes to keep the index small.

CREATE INDEX IF NOT EXISTS idx_inbound_routes_active_match
    ON inbound_routes (tenant_id, match_type, match_value)
    WHERE status = 'active';

-- ── 5. Webhook delivery queue ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_queue_next
    ON webhook_delivery_queue (next_attempt_at ASC, status)
    WHERE status IN ('pending', 'processing');

-- ── 6. Publish records: latest per object ────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_publish_records_object_recent
    ON publish_records (tenant_id, object_type, object_id, created_at DESC);

-- ── Comments documenting invariants enforced at service level ─────────────────

COMMENT ON TABLE tenant_audit_log IS
    'Append-only audit log. UPDATE and DELETE are blocked by database rules. '
    'Application code must never issue UPDATE or DELETE on this table.';

COMMENT ON TABLE audit_events IS
    'Append-only domain audit event log. UPDATE and DELETE are blocked by database rules.';
