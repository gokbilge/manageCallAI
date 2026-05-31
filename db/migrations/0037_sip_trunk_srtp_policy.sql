-- Per-trunk SRTP policy for production SIP deployment guidance.

ALTER TABLE sip_trunks
    ADD COLUMN IF NOT EXISTS srtp_policy text NOT NULL DEFAULT 'disabled'
        CHECK (srtp_policy IN ('disabled', 'optional', 'required'));

COMMENT ON COLUMN sip_trunks.srtp_policy IS
    'Per-trunk SRTP policy. disabled = no SRTP requirement, optional = accept SRTP where negotiated, required = trunk must use SRTP-capable FreeSWITCH profile/gateway settings.';
