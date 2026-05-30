-- DTMF mode and codec policy per SIP trunk.
--
-- dtmf_mode: how DTMF digits are transported on this trunk.
--   rfc2833  — RTP telephone-event (recommended default).
--   info     — SIP INFO messages.
--   inband   — Analog DTMF tones in the audio stream.
--   auto     — Negotiated by FreeSWITCH during call setup.
--
-- codec_prefs: ordered codec preference list applied when this trunk is used.
--   NULL = use FreeSWITCH global codec preference.
--   Example: ['PCMU', 'PCMA', 'G729', 'G722']

ALTER TABLE sip_trunks
    ADD COLUMN IF NOT EXISTS dtmf_mode text NOT NULL DEFAULT 'rfc2833'
        CHECK (dtmf_mode IN ('rfc2833', 'info', 'inband', 'auto'));

ALTER TABLE sip_trunks
    ADD COLUMN IF NOT EXISTS codec_prefs text[];

COMMENT ON COLUMN sip_trunks.dtmf_mode IS
    'DTMF transport mode for this trunk. rfc2833 is the recommended default.';

COMMENT ON COLUMN sip_trunks.codec_prefs IS
    'Ordered codec preference list for this trunk. NULL = use FreeSWITCH global preference. '
    'Example: ARRAY[''PCMU'',''PCMA'',''G729'']';
