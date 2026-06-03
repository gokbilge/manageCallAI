-- SLICE-61: Native conferencing via mod_conference
--
-- Conference rooms are desired-state objects. Active rooms are projected into
-- FreeSWITCH dialplan and conference.conf via mod_xml_curl. PINs are stored
-- AES-256-GCM encrypted; never returned in plaintext via the REST API.

CREATE TABLE IF NOT EXISTS conference_rooms (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                text NOT NULL,
    room_number         text NOT NULL,
    -- AES-256-GCM encrypted PIN; null = no PIN required.
    -- Format: base64(iv).base64(authTag).base64(ciphertext) — same as SIP password.
    pin_ciphertext      text,
    pin_key_id          text,
    max_participants    int NOT NULL DEFAULT 20,
    record_calls        boolean NOT NULL DEFAULT false,
    status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'disabled')),
    created_by          uuid,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, room_number)
);

-- Participant snapshot: updated by Go agent conference events (optional).
CREATE TABLE IF NOT EXISTS conference_participant_snapshots (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conference_room_id  uuid NOT NULL REFERENCES conference_rooms(id) ON DELETE CASCADE,
    call_id             text NOT NULL,
    joined_at           timestamptz NOT NULL DEFAULT now(),
    left_at             timestamptz
);

CREATE INDEX IF NOT EXISTS idx_conference_rooms_tenant
    ON conference_rooms (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_conference_participants_room
    ON conference_participant_snapshots (conference_room_id)
    WHERE left_at IS NULL;

COMMENT ON TABLE conference_rooms IS
    'Tenant-scoped conference rooms. Active rooms are served via mod_xml_curl '
    'dialplan and conference.conf endpoints. PINs are AES-256-GCM encrypted.';

COMMENT ON COLUMN conference_rooms.pin_ciphertext IS
    'AES-256-GCM encrypted conference PIN. '
    'Decrypted only when building FreeSWITCH dialplan XML; never returned in API responses.';
