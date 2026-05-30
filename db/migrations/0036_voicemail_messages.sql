-- Voicemail message storage and retrieval.
--
-- voicemail_boxes already exists (0016). This migration adds voicemail_messages
-- to model actual deposited voice messages so operators can list, play, download,
-- and delete them through the API.

CREATE TABLE IF NOT EXISTS voicemail_messages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    voicemail_box_id uuid NOT NULL REFERENCES voicemail_boxes(id) ON DELETE CASCADE,
    call_id         text NOT NULL,
    storage_path    text NOT NULL,
    duration_secs   integer,
    size_bytes      bigint,
    read_at         timestamptz,
    deleted_at      timestamptz,
    recorded_at     timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voicemail_messages_box_unread
    ON voicemail_messages (tenant_id, voicemail_box_id, recorded_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS voicemail_messages_call_id
    ON voicemail_messages (tenant_id, call_id);
