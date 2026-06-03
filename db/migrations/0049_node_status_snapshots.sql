-- SLICE-66: FreeSWITCH runtime management — read-only node status snapshots
--
-- The Go agent polls FreeSWITCH via safe ESL read commands and pushes
-- snapshots here. The API exposes these as read-only status endpoints.
-- One row per node: upserted on each push, never accumulated as history.

CREATE TABLE IF NOT EXISTS freeswitch_node_status_snapshots (
    node_id                     uuid PRIMARY KEY REFERENCES freeswitch_nodes(id) ON DELETE CASCADE,
    queried_at                  timestamptz NOT NULL DEFAULT now(),
    freeswitch_version          text,
    loaded_modules              text[] NOT NULL DEFAULT '{}',
    missing_required_modules    text[] NOT NULL DEFAULT '{}',
    sofia_profiles              jsonb NOT NULL DEFAULT '{}',
    gateway_statuses            jsonb NOT NULL DEFAULT '{}',
    active_channel_count        int,
    active_registration_count   int
);

COMMENT ON TABLE freeswitch_node_status_snapshots IS
    'Live FreeSWITCH status snapshot per node. Pushed by the Go agent every 30 s. '
    'One row per node — upserted, not appended.';

COMMENT ON COLUMN freeswitch_node_status_snapshots.missing_required_modules IS
    'Required modules (mod_sofia, mod_xml_curl, etc.) that are not currently loaded. '
    'Non-empty list triggers a health alert.';
