-- SLICE-48: Security Alert Rules
--
-- Adds first-party abuse alert rules and fired alert instances.
-- Rules are tenant-scoped and evaluate deterministic thresholds against
-- existing event tables (extension_event_log, call_events, webhook_delivery_queue,
-- recording_analysis_requests).
--
-- Alerts are business-level: they do not expose raw FreeSWITCH payloads or
-- provider internals.

-- ── Alert rule definitions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS security_alert_rules (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    name        text NOT NULL,
    description text,

    -- Discriminator for the evaluator switch
    alert_type  text NOT NULL CHECK (alert_type IN (
        'failed_sip_registration',
        'outbound_call_burst',
        'unknown_destination_call',
        'runtime_auth_failure',
        'webhook_delivery_backlog',
        'recording_analysis_backlog'
    )),

    -- Evaluation thresholds — flexible JSON for each alert_type.
    -- failed_sip_registration:  { "threshold": 5, "window_minutes": 10 }
    -- outbound_call_burst:       { "threshold": 20, "window_minutes": 1 }
    -- unknown_destination_call:  { "threshold": 3, "window_minutes": 30 }
    -- runtime_auth_failure:      { "threshold": 5, "window_minutes": 5 }
    -- webhook_delivery_backlog:  { "max_failed": 10, "max_abandoned": 5 }
    -- recording_analysis_backlog:{ "max_queued": 50, "age_minutes": 60 }
    conditions  jsonb NOT NULL DEFAULT '{}'::jsonb,

    -- Severity emitted when the rule fires
    severity    text NOT NULL DEFAULT 'warning'
                     CHECK (severity IN ('info', 'warning', 'critical')),

    status      text NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'inactive', 'archived')),

    created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_alert_rules_tenant_active
    ON security_alert_rules (tenant_id, status, alert_type);

-- ── Fired alert instances ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS security_alerts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rule_id         uuid NOT NULL REFERENCES security_alert_rules(id) ON DELETE CASCADE,

    -- Denormalised from rule so alerts survive rule updates
    alert_type      text NOT NULL,
    severity        text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),

    message         text NOT NULL,
    -- { "count": 7, "window_minutes": 10, "source_ip": "..." }
    context_json    jsonb,

    status          text NOT NULL DEFAULT 'new'
                         CHECK (status IN ('new', 'acknowledged', 'resolved', 'dismissed')),
    acknowledged_by uuid REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at timestamptz,
    resolved_at     timestamptz,

    fired_at        timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_alerts_tenant_status
    ON security_alerts (tenant_id, status, fired_at DESC);

CREATE INDEX IF NOT EXISTS security_alerts_rule
    ON security_alerts (rule_id, fired_at DESC);

-- ── Alert deduplication ───────────────────────────────────────────────────────
-- Prevent the same rule from firing more often than once per cooldown window.

CREATE TABLE IF NOT EXISTS security_alert_cooldowns (
    rule_id       uuid NOT NULL REFERENCES security_alert_rules(id) ON DELETE CASCADE,
    tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    last_fired_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (rule_id, tenant_id)
);
