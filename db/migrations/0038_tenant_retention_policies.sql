-- SLICE-47: Recording Retention And Privacy
--
-- Adds tenant-scoped retention policy and legal hold support.
-- Retention is configured per media type; legal holds block purge regardless
-- of retention schedule.
--
-- Recording purge is handled by the worker process on a scheduled interval.

-- ── Tenant retention policy ──────────────────────────────────────────────────
-- One policy row per tenant (UNIQUE on tenant_id).
-- NULL period = indefinite retention (safe default for compliance).

CREATE TABLE IF NOT EXISTS tenant_retention_policies (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,

    -- Retention periods in days. NULL means keep forever.
    recording_retention_days  integer CHECK (recording_retention_days IS NULL OR recording_retention_days > 0),
    transcript_retention_days integer CHECK (transcript_retention_days IS NULL OR transcript_retention_days > 0),
    cdr_retention_days        integer CHECK (cdr_retention_days IS NULL OR cdr_retention_days > 0),

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tenant_retention_policies IS
    'One retention policy per tenant. NULL retention_days = keep forever.';

-- ── Legal hold requests ───────────────────────────────────────────────────────
-- Holds prevent data purge even after the retention period expires.
-- Tenant admins can create holds (e.g. for litigation) and release them.

CREATE TABLE IF NOT EXISTS legal_hold_requests (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- What is on hold
    resource_type  text NOT NULL CHECK (resource_type IN ('recording', 'transcript', 'cdr', 'all')),
    -- NULL resource_id = all resources of that type
    resource_id    text,

    -- Why / who
    initiated_by   uuid NOT NULL REFERENCES users(id),
    case_reference text,
    reason         text NOT NULL,

    -- Lifecycle
    status         text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'released', 'expired')),
    released_by    uuid REFERENCES users(id),
    released_at    timestamptz,
    expires_at     timestamptz,

    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_hold_requests_tenant_status
    ON legal_hold_requests (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS legal_hold_requests_resource
    ON legal_hold_requests (tenant_id, resource_type, resource_id)
    WHERE status = 'active';

COMMENT ON TABLE legal_hold_requests IS
    'Active legal hold requests block data purge regardless of retention schedule.';
