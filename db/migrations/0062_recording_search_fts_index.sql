-- Full-text search indexes for recording transcript and summary search (#256)
-- GIN indexes enable fast @@ (tsvector match) queries on text columns

CREATE INDEX IF NOT EXISTS recording_analysis_fts_transcript_idx
  ON recording_analysis_requests
  USING GIN (to_tsvector('english', coalesce(transcript_text, '')))
  WHERE status = 'completed' AND transcript_text IS NOT NULL;

CREATE INDEX IF NOT EXISTS recording_analysis_fts_summary_idx
  ON recording_analysis_requests
  USING GIN (to_tsvector('english', coalesce(summary_text, '')))
  WHERE status = 'completed' AND summary_text IS NOT NULL;
