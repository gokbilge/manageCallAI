ALTER TABLE tenant_ai_policy_overrides
  ADD COLUMN IF NOT EXISTS recording_analysis_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_analysis_preferred_provider text
    CHECK (
      recording_analysis_preferred_provider IS NULL
      OR recording_analysis_preferred_provider IN ('openai', 'elevenlabs', 'whisper', 'external', 'custom')
    );

ALTER TABLE recording_analysis_requests
  ADD COLUMN IF NOT EXISTS provider_hint text NOT NULL DEFAULT 'auto'
    CHECK (provider_hint IN ('auto', 'openai', 'elevenlabs', 'whisper', 'external', 'custom')),
  ADD COLUMN IF NOT EXISTS transcript_status text
    CHECK (transcript_status IS NULL OR transcript_status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  ADD COLUMN IF NOT EXISTS summary_status text
    CHECK (summary_status IS NULL OR summary_status IN ('queued', 'processing', 'completed', 'failed', 'cancelled'));

UPDATE tenant_ai_policy_overrides
   SET recording_analysis_enabled = false
 WHERE recording_analysis_enabled IS DISTINCT FROM false;

UPDATE recording_analysis_requests
   SET provider_hint = COALESCE(provider_hint, 'auto'),
       transcript_status = CASE
         WHEN transcript_status IS NOT NULL THEN transcript_status
         WHEN 'transcript' = ANY(requested_outputs) AND status = 'completed' AND transcript_text IS NOT NULL THEN 'completed'
         WHEN 'transcript' = ANY(requested_outputs) AND status IN ('failed', 'cancelled') THEN status
         WHEN 'transcript' = ANY(requested_outputs) THEN status
         ELSE NULL
       END,
       summary_status = CASE
         WHEN summary_status IS NOT NULL THEN summary_status
         WHEN 'summary' = ANY(requested_outputs) AND status = 'completed' AND summary_text IS NOT NULL THEN 'completed'
         WHEN 'summary' = ANY(requested_outputs) AND status IN ('failed', 'cancelled') THEN status
         WHEN 'summary' = ANY(requested_outputs) THEN status
         ELSE NULL
       END;

COMMENT ON COLUMN recording_analysis_requests.provider_hint IS
  'Effective provider hint for recording transcript/summary analysis. auto means deterministic or provider-neutral fallback.';

COMMENT ON COLUMN recording_analysis_requests.transcript_status IS
  'Per-output transcript lifecycle state for the recording analysis request.';

COMMENT ON COLUMN recording_analysis_requests.summary_status IS
  'Per-output summary lifecycle state for the recording analysis request.';
