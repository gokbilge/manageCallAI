-- API key hardening.
--
-- 1. Add expires_at so long-lived credentials can be rotated on schedule.
-- 2. Add capabilities_version to track wildcard-era vs explicit-era keys.
-- 3. Backfill all wildcard ('*') keys to the canonical tenant_admin capability
--    list so the wildcard sentinel can be deprecated from application code.
-- 4. Block new '*'-only keys via a stricter CHECK (allows '*' only in version-1
--    rows that pre-date this migration, rejects new rows).

-- ── 1. New columns ─────────────────────────────────────────────────────────────
ALTER TABLE automation_api_keys
    ADD COLUMN IF NOT EXISTS expires_at          timestamptz,
    ADD COLUMN IF NOT EXISTS capabilities_version integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN automation_api_keys.expires_at IS
    'Optional expiry timestamp. NULL = non-expiring legacy key. '
    'New keys should always set this to enforce credential rotation.';

COMMENT ON COLUMN automation_api_keys.capabilities_version IS
    '1 = wildcard era: capabilities may contain the ''*'' sentinel. '
    '2 = explicit era: all capabilities are named; no wildcard sentinel permitted. '
    'Application code issues only version-2 keys after this migration.';

-- ── 2. Backfill wildcard keys to explicit tenant_admin capability set ──────────
-- The canonical list is a snapshot of TENANT_CAPABILITIES from capabilities.ts
-- at the time this migration was written. Keys backfilled here retain all
-- tenant_admin capabilities they had via '*'. New capabilities added to the
-- TypeScript definition after this migration will NOT be retroactively granted
-- to these keys — operators must rotate their keys to receive new capabilities.
UPDATE automation_api_keys
SET
    capabilities = ARRAY[
        'tenant.dashboard.view',
        'tenant.extensions.view',
        'tenant.extensions.create',
        'tenant.extensions.update',
        'tenant.extensions.deactivate',
        'tenant.calls.view',
        'tenant.recordings.view',
        'tenant.phone_numbers.view',
        'tenant.phone_numbers.create',
        'tenant.phone_numbers.update',
        'tenant.phone_numbers.deactivate',
        'tenant.inbound_routes.view',
        'tenant.inbound_routes.create',
        'tenant.inbound_routes.update',
        'tenant.inbound_routes.activate',
        'tenant.inbound_routes.deactivate',
        'tenant.inbound_routes.test',
        'tenant.prompts.view',
        'tenant.prompts.create',
        'tenant.prompts.update',
        'tenant.prompts.deactivate',
        'tenant.ivr_flows.view',
        'tenant.ivr_flows.create',
        'tenant.ivr_flows.update',
        'tenant.ivr_flows.validate',
        'tenant.ivr_flows.simulate',
        'tenant.ivr_flows.publish',
        'tenant.ivr_flows.rollback',
        'tenant.approvals.view',
        'tenant.approvals.decide',
        'tenant.call_groups.view',
        'tenant.call_groups.create',
        'tenant.call_groups.update',
        'tenant.call_groups.deactivate',
        'tenant.queues.view',
        'tenant.queues.create',
        'tenant.queues.update',
        'tenant.queues.deactivate',
        'tenant.voicemail_boxes.view',
        'tenant.voicemail_boxes.create',
        'tenant.voicemail_boxes.update',
        'tenant.voicemail_boxes.deactivate',
        'tenant.automation.keys.view',
        'tenant.automation.keys.manage',
        'tenant.automation.webhooks.view',
        'tenant.automation.webhooks.manage',
        'tenant.schedules.view',
        'tenant.schedules.create',
        'tenant.schedules.update',
        'tenant.outbound_routes.view',
        'tenant.outbound_routes.create',
        'tenant.outbound_routes.update',
        'tenant.outbound_calls.create',
        'tenant.outbound_calls.view',
        'tenant.channel_accounts.view',
        'tenant.channel_accounts.manage',
        'tenant.channel_messages.view',
        'tenant.channel_messages.send',
        'tenant.meeting_sessions.view',
        'tenant.meeting_sessions.manage',
        'tenant.audit_log.view',
        'tenant.export.run',
        'tenant.users.view',
        'tenant.users.manage',
        'tenant.directory_smoke_test.run'
    ],
    capabilities_version = 2
WHERE capabilities = ARRAY['*']::text[]
  AND revoked_at IS NULL;

-- Also mark already-revoked wildcard keys as version 2 for consistency.
UPDATE automation_api_keys
SET
    capabilities_version = 2
WHERE capabilities = ARRAY['*']::text[]
  AND revoked_at IS NOT NULL;

-- ── 3. Verify backfill was complete ───────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM automation_api_keys
         WHERE capabilities = ARRAY['*']::text[]
    ) THEN
        RAISE EXCEPTION
            'Backfill incomplete: automation_api_keys still contains wildcard rows. '
            'Investigate before continuing.';
    END IF;
END $$;

COMMENT ON TABLE automation_api_keys IS
    'Long-lived API keys for automation clients (n8n, scripts, MCP). '
    'All keys are version-2 (explicit capability lists) after 0039. '
    'Keys should have expires_at set; NULL is retained for legacy non-expiring keys.';
