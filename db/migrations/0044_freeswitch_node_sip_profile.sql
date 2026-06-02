-- SLICE: FreeSWITCH node SIP profile configuration
--
-- Adds per-node SIP profile settings so operators can configure FreeSWITCH
-- nodes through manageCallAI instead of editing XML files manually.
-- These values are served via the mod_xml_curl configuration endpoint and
-- override the FreeSWITCH stock defaults for the external SIP profile.

ALTER TABLE freeswitch_nodes
    ADD COLUMN IF NOT EXISTS sip_domain          text,
    ADD COLUMN IF NOT EXISTS external_sip_ip     text,
    ADD COLUMN IF NOT EXISTS external_rtp_ip     text,
    ADD COLUMN IF NOT EXISTS sip_port            int  NOT NULL DEFAULT 5060,
    ADD COLUMN IF NOT EXISTS sip_tls_port        int  NOT NULL DEFAULT 5061,
    ADD COLUMN IF NOT EXISTS tls_enabled         boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS srtp_policy         text NOT NULL DEFAULT 'disabled'
                                                      CHECK (srtp_policy IN ('disabled','optional','required')),
    ADD COLUMN IF NOT EXISTS rtp_port_min        int  NOT NULL DEFAULT 16384,
    ADD COLUMN IF NOT EXISTS rtp_port_max        int  NOT NULL DEFAULT 32768,
    ADD COLUMN IF NOT EXISTS codec_prefs         text NOT NULL DEFAULT 'PCMU,PCMA,G722',
    ADD COLUMN IF NOT EXISTS dtmf_type           text NOT NULL DEFAULT 'rfc2833'
                                                      CHECK (dtmf_type IN ('rfc2833','info','inband'));

COMMENT ON COLUMN freeswitch_nodes.sip_domain IS
    'SIP domain served by this node. Used as the default directory/dialplan domain.';
COMMENT ON COLUMN freeswitch_nodes.external_sip_ip IS
    'Public IP inserted into SDP Contact headers for NAT traversal.';
COMMENT ON COLUMN freeswitch_nodes.external_rtp_ip IS
    'Public IP inserted into SDP media lines for NAT traversal.';
COMMENT ON COLUMN freeswitch_nodes.tls_enabled IS
    'Whether TLS SIP transport is enabled on this node.';
COMMENT ON COLUMN freeswitch_nodes.srtp_policy IS
    'SRTP policy: disabled, optional, or required.';
