CREATE TABLE IF NOT EXISTS push_notification_tokens (
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    platform   text NOT NULL
               CHECK (platform IN ('apns', 'fcm', 'web')),
    token      text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_tenant
    ON push_notification_tokens (tenant_id);

COMMENT ON TABLE push_notification_tokens IS
    'Device push-notification tokens per user per platform. One active token per (user_id, platform). '
    'Actual push delivery is a future work item — see docs/integrations/push-notifications.md.';
