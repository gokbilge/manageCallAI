-- Migration 0077: Commercial Entitlement Foundation
-- Creates commercial_plans, plan_entitlements, tenant_subscriptions,
-- tenant_entitlement_overrides, tenant_usage_counters, and usage_events tables,
-- then seeds Free, Pro, and Enterprise plans with all capability entitlements.

CREATE TABLE commercial_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE commercial_plan_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES commercial_plans(id) ON DELETE CASCADE,
  capability_key text NOT NULL,
  integer_value bigint,
  string_value text,
  unit text,
  UNIQUE (plan_id, capability_key)
);

CREATE TABLE tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES commercial_plans(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  started_at timestamptz NOT NULL DEFAULT NOW(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);

CREATE TABLE tenant_entitlement_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  capability_key text NOT NULL,
  integer_value bigint,
  string_value text,
  expires_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, capability_key)
);

CREATE TABLE tenant_usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  counter_key text NOT NULL,
  period_start date NOT NULL,
  count bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, counter_key, period_start)
);

CREATE TABLE usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  quantity bigint NOT NULL DEFAULT 1,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX ON usage_events (tenant_id, event_key, created_at);
CREATE INDEX ON tenant_usage_counters (tenant_id, counter_key, period_start);

-- Seed plans and entitlements
DO $$
DECLARE
  free_id uuid;
  pro_id uuid;
  ent_id uuid;
BEGIN
  -- Insert plans
  INSERT INTO commercial_plans (name, display_name, is_default)
    VALUES ('free', 'Free', true)
    RETURNING id INTO free_id;

  INSERT INTO commercial_plans (name, display_name, is_default)
    VALUES ('pro', 'Pro', false)
    RETURNING id INTO pro_id;

  INSERT INTO commercial_plans (name, display_name, is_default)
    VALUES ('enterprise', 'Enterprise', false)
    RETURNING id INTO ent_id;

  -- Free plan entitlements
  INSERT INTO commercial_plan_entitlements (plan_id, capability_key, integer_value, string_value, unit) VALUES
    (free_id, 'tenant.max_count',                       1,    NULL, 'count'),
    (free_id, 'user.admin.max_count',                   2,    NULL, 'count'),
    (free_id, 'user.end_user.max_count',                10,   NULL, 'count'),
    (free_id, 'extension.max_count',                    25,   NULL, 'count'),
    (free_id, 'device.max_count',                       25,   NULL, 'count'),
    (free_id, 'sip_trunk.max_count',                    2,    NULL, 'count'),
    (free_id, 'did.max_count',                          10,   NULL, 'count'),
    (free_id, 'route.inbound.max_count',                10,   NULL, 'count'),
    (free_id, 'route.outbound.max_count',               5,    NULL, 'count'),
    (free_id, 'ivr.flow.max_count',                     5,    NULL, 'count'),
    (free_id, 'ivr.version.max_per_flow',               5,    NULL, 'count'),
    (free_id, 'queue.max_count',                        2,    NULL, 'count'),
    (free_id, 'ring_group.max_count',                   5,    NULL, 'count'),
    (free_id, 'voicemail_box.max_count',                25,   NULL, 'count'),
    (free_id, 'conference_room.max_count',              1,    NULL, 'count'),
    (free_id, 'parking_lot.max_count',                  1,    NULL, 'count'),
    (free_id, 'schedule.max_count',                     5,    NULL, 'count'),
    (free_id, 'holiday_calendar.max_count',             1,    NULL, 'count'),
    (free_id, 'feature_code.max_count',                 10,   NULL, 'count'),
    (free_id, 'api_key.max_count',                      1,    NULL, 'count'),
    (free_id, 'webhook.max_count',                      1,    NULL, 'count'),
    (free_id, 'n8n.connection.max_count',               1,    NULL, 'count'),
    (free_id, 'call_events.monthly_limit',              5000, NULL, 'monthly'),
    (free_id, 'call_events.retention_days',             14,   NULL, 'days'),
    (free_id, 'audit.retention_days',                   30,   NULL, 'days'),
    (free_id, 'recording.storage_mb',                   500,  NULL, 'mb'),
    (free_id, 'recording.retention_days',               7,    NULL, 'days'),
    (free_id, 'voicemail.storage_mb',                   250,  NULL, 'mb'),
    (free_id, 'transcript.storage_mb',                  50,   NULL, 'mb'),
    (free_id, 'ai.failure_explanation.monthly_limit',   25,   NULL, 'monthly'),
    (free_id, 'ai.route_risk.monthly_limit',            10,   NULL, 'monthly'),
    (free_id, 'ai.summary.monthly_limit',               10,   NULL, 'monthly'),
    (free_id, 'ai.nl_report.monthly_limit',             10,   NULL, 'monthly'),
    (free_id, 'migration.analysis.monthly_limit',       1,    NULL, 'monthly'),
    (free_id, 'migration.draft_import.monthly_limit',   0,    NULL, 'monthly');

  -- Pro plan entitlements
  INSERT INTO commercial_plan_entitlements (plan_id, capability_key, integer_value, string_value, unit) VALUES
    (pro_id, 'tenant.max_count',                       3,      NULL, 'count'),
    (pro_id, 'user.admin.max_count',                   10,     NULL, 'count'),
    (pro_id, 'user.end_user.max_count',                100,    NULL, 'count'),
    (pro_id, 'extension.max_count',                    250,    NULL, 'count'),
    (pro_id, 'device.max_count',                       300,    NULL, 'count'),
    (pro_id, 'sip_trunk.max_count',                    10,     NULL, 'count'),
    (pro_id, 'did.max_count',                          250,    NULL, 'count'),
    (pro_id, 'route.inbound.max_count',                250,    NULL, 'count'),
    (pro_id, 'route.outbound.max_count',               100,    NULL, 'count'),
    (pro_id, 'ivr.flow.max_count',                     50,     NULL, 'count'),
    (pro_id, 'ivr.version.max_per_flow',               25,     NULL, 'count'),
    (pro_id, 'queue.max_count',                        25,     NULL, 'count'),
    (pro_id, 'ring_group.max_count',                   50,     NULL, 'count'),
    (pro_id, 'voicemail_box.max_count',                250,    NULL, 'count'),
    (pro_id, 'conference_room.max_count',              25,     NULL, 'count'),
    (pro_id, 'parking_lot.max_count',                  10,     NULL, 'count'),
    (pro_id, 'schedule.max_count',                     100,    NULL, 'count'),
    (pro_id, 'holiday_calendar.max_count',             25,     NULL, 'count'),
    (pro_id, 'feature_code.max_count',                 100,    NULL, 'count'),
    (pro_id, 'api_key.max_count',                      25,     NULL, 'count'),
    (pro_id, 'webhook.max_count',                      25,     NULL, 'count'),
    (pro_id, 'n8n.connection.max_count',               10,     NULL, 'count'),
    (pro_id, 'call_events.monthly_limit',              500000, NULL, 'monthly'),
    (pro_id, 'call_events.retention_days',             90,     NULL, 'days'),
    (pro_id, 'audit.retention_days',                   365,    NULL, 'days'),
    (pro_id, 'recording.storage_mb',                   51200,  NULL, 'mb'),
    (pro_id, 'recording.retention_days',               30,     NULL, 'days'),
    (pro_id, 'voicemail.storage_mb',                   10240,  NULL, 'mb'),
    (pro_id, 'transcript.storage_mb',                  2048,   NULL, 'mb'),
    (pro_id, 'ai.failure_explanation.monthly_limit',   2500,   NULL, 'monthly'),
    (pro_id, 'ai.route_risk.monthly_limit',            1000,   NULL, 'monthly'),
    (pro_id, 'ai.summary.monthly_limit',               2500,   NULL, 'monthly'),
    (pro_id, 'ai.nl_report.monthly_limit',             1000,   NULL, 'monthly'),
    (pro_id, 'migration.analysis.monthly_limit',       5,      NULL, 'monthly'),
    (pro_id, 'migration.draft_import.monthly_limit',   5,      NULL, 'monthly');

  -- Enterprise plan entitlements (contract-defined; no hard integer block)
  INSERT INTO commercial_plan_entitlements (plan_id, capability_key, integer_value, string_value, unit) VALUES
    (ent_id, 'tenant.max_count',                       NULL, 'contract', 'count'),
    (ent_id, 'user.admin.max_count',                   NULL, 'contract', 'count'),
    (ent_id, 'user.end_user.max_count',                NULL, 'contract', 'count'),
    (ent_id, 'extension.max_count',                    NULL, 'contract', 'count'),
    (ent_id, 'device.max_count',                       NULL, 'contract', 'count'),
    (ent_id, 'sip_trunk.max_count',                    NULL, 'contract', 'count'),
    (ent_id, 'did.max_count',                          NULL, 'contract', 'count'),
    (ent_id, 'route.inbound.max_count',                NULL, 'contract', 'count'),
    (ent_id, 'route.outbound.max_count',               NULL, 'contract', 'count'),
    (ent_id, 'ivr.flow.max_count',                     NULL, 'contract', 'count'),
    (ent_id, 'ivr.version.max_per_flow',               NULL, 'contract', 'count'),
    (ent_id, 'queue.max_count',                        NULL, 'contract', 'count'),
    (ent_id, 'ring_group.max_count',                   NULL, 'contract', 'count'),
    (ent_id, 'voicemail_box.max_count',                NULL, 'contract', 'count'),
    (ent_id, 'conference_room.max_count',              NULL, 'contract', 'count'),
    (ent_id, 'parking_lot.max_count',                  NULL, 'contract', 'count'),
    (ent_id, 'schedule.max_count',                     NULL, 'contract', 'count'),
    (ent_id, 'holiday_calendar.max_count',             NULL, 'contract', 'count'),
    (ent_id, 'feature_code.max_count',                 NULL, 'contract', 'count'),
    (ent_id, 'api_key.max_count',                      NULL, 'contract', 'count'),
    (ent_id, 'webhook.max_count',                      NULL, 'contract', 'count'),
    (ent_id, 'n8n.connection.max_count',               NULL, 'contract', 'count'),
    (ent_id, 'call_events.monthly_limit',              NULL, 'contract', 'monthly'),
    (ent_id, 'call_events.retention_days',             NULL, 'contract', 'days'),
    (ent_id, 'audit.retention_days',                   NULL, 'contract', 'days'),
    (ent_id, 'recording.storage_mb',                   NULL, 'contract', 'mb'),
    (ent_id, 'recording.retention_days',               NULL, 'contract', 'days'),
    (ent_id, 'voicemail.storage_mb',                   NULL, 'contract', 'mb'),
    (ent_id, 'transcript.storage_mb',                  NULL, 'contract', 'mb'),
    (ent_id, 'ai.failure_explanation.monthly_limit',   NULL, 'contract', 'monthly'),
    (ent_id, 'ai.route_risk.monthly_limit',            NULL, 'contract', 'monthly'),
    (ent_id, 'ai.summary.monthly_limit',               NULL, 'contract', 'monthly'),
    (ent_id, 'ai.nl_report.monthly_limit',             NULL, 'contract', 'monthly'),
    (ent_id, 'migration.analysis.monthly_limit',       NULL, 'contract', 'monthly'),
    (ent_id, 'migration.draft_import.monthly_limit',   NULL, 'contract', 'monthly');
END $$;
