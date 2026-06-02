-- Production retention purge expansion.
--
-- Extends the slice-47 retention policy from recordings/transcripts/CDRs to
-- voicemail messages, call events, AI summaries, and generated media.

ALTER TABLE tenant_retention_policies
    ADD COLUMN IF NOT EXISTS voicemail_retention_days integer
        CHECK (voicemail_retention_days IS NULL OR voicemail_retention_days > 0),
    ADD COLUMN IF NOT EXISTS call_event_retention_days integer
        CHECK (call_event_retention_days IS NULL OR call_event_retention_days > 0),
    ADD COLUMN IF NOT EXISTS ai_summary_retention_days integer
        CHECK (ai_summary_retention_days IS NULL OR ai_summary_retention_days > 0),
    ADD COLUMN IF NOT EXISTS generated_media_retention_days integer
        CHECK (generated_media_retention_days IS NULL OR generated_media_retention_days > 0);

ALTER TABLE legal_hold_requests
    DROP CONSTRAINT IF EXISTS legal_hold_requests_resource_type_check;

ALTER TABLE legal_hold_requests
    ADD CONSTRAINT legal_hold_requests_resource_type_check
    CHECK (resource_type IN (
        'recording',
        'voicemail',
        'transcript',
        'summary',
        'cdr',
        'call_event',
        'generated_media',
        'all'
    ));

CREATE INDEX IF NOT EXISTS call_detail_records_retention_due
    ON call_detail_records (tenant_id, start_time);

CREATE INDEX IF NOT EXISTS call_events_retention_due
    ON call_events (tenant_id, event_time);

CREATE INDEX IF NOT EXISTS voicemail_messages_retention_due
    ON voicemail_messages (tenant_id, recorded_at)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS recording_analysis_transcript_retention_due
    ON recording_analysis_requests (tenant_id, completed_at)
    WHERE transcript_text IS NOT NULL OR summary_text IS NOT NULL;

CREATE INDEX IF NOT EXISTS prompt_generation_media_retention_due
    ON prompt_generation_requests (tenant_id, completed_at)
    WHERE media_reference IS NOT NULL;
