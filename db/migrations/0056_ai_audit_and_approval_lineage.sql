ALTER TABLE flow_versions
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE publish_records
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_flow_versions_ai_lineage
  ON flow_versions (tenant_id, flow_id)
  WHERE metadata ? 'ai_lineage';

CREATE INDEX IF NOT EXISTS idx_approval_requests_ai_lineage
  ON approval_requests (tenant_id, created_at DESC)
  WHERE metadata ? 'ai_lineage';

CREATE INDEX IF NOT EXISTS idx_publish_records_ai_lineage
  ON publish_records (tenant_id, object_type, object_id, created_at DESC)
  WHERE metadata ? 'ai_lineage';
