import type { Pool } from 'pg';
import type {
  ClaimRecordingAnalysisInput,
  CompleteRecordingAnalysisInput,
  CreateLegalHoldInput,
  CreateRecordingAnalysisInput,
  IngestRecordingInput,
  LegalHold,
  LegalHoldListFilter,
  Recording,
  RecordingAnalysisRequest,
  TenantRetentionPolicy,
  UpdateRetentionPolicyInput,
} from './recording.types.js';

export class RecordingRepository {
  constructor(private readonly db: Pool) {}

  async create(input: IngestRecordingInput): Promise<Recording> {
    const result = await this.db.query<Recording>(
      `INSERT INTO call_recordings
         (tenant_id, call_id, call_event_id, storage_path, duration_secs, size_bytes, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()))
       RETURNING id, tenant_id, call_id, call_event_id, storage_path, duration_secs, size_bytes, status, recorded_at, created_at`,
      [
        input.tenant_id,
        input.call_id,
        input.call_event_id ?? null,
        input.storage_path,
        input.duration_secs ?? null,
        input.size_bytes ?? null,
        input.recorded_at ?? null,
      ],
    );
    return result.rows[0]!;
  }

  async listByTenant(tenantId: string, callId?: string): Promise<Recording[]> {
    const conditions = ['tenant_id = $1', "status != 'deleted'"];
    const values: unknown[] = [tenantId];
    if (callId) {
      conditions.push(`call_id = $2`);
      values.push(callId);
    }
    const result = await this.db.query<Recording>(
      `SELECT id, tenant_id, call_id, call_event_id, storage_path, duration_secs, size_bytes, status, recorded_at, created_at
       FROM call_recordings
       WHERE ${conditions.join(' AND ')}
       ORDER BY recorded_at DESC
       LIMIT 200`,
      values,
    );
    return result.rows;
  }

  async findById(id: string, tenantId: string): Promise<Recording | null> {
    const result = await this.db.query<Recording>(
      `SELECT id, tenant_id, call_id, call_event_id, storage_path, duration_secs, size_bytes, status, recorded_at, created_at
       FROM call_recordings
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async createAnalysisRequest(
    recordingId: string,
    tenantId: string,
    input: CreateRecordingAnalysisInput,
  ): Promise<RecordingAnalysisRequest> {
    const result = await this.db.query<RecordingAnalysisRequest>(
      `INSERT INTO recording_analysis_requests
         (tenant_id, recording_id, requested_outputs, language_hint, metadata)
       SELECT $1, id, $3, $4, $5::jsonb
       FROM call_recordings
       WHERE id = $2 AND tenant_id = $1 AND status != 'deleted'
       RETURNING id, tenant_id, recording_id, requested_outputs, language_hint, status, processor_id,
                 claimed_at, language, transcript_text, summary_text, error_message, provider_metadata,
                 metadata, created_at, completed_at`,
      [
        tenantId,
        recordingId,
        input.requested_outputs,
        input.language_hint ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return result.rows[0]!;
  }

  async listAnalysisRequests(recordingId: string, tenantId: string): Promise<RecordingAnalysisRequest[]> {
    const result = await this.db.query<RecordingAnalysisRequest>(
      `SELECT id, tenant_id, recording_id, requested_outputs, language_hint, status, processor_id,
              claimed_at, language, transcript_text, summary_text, error_message, provider_metadata,
              metadata, created_at, completed_at
       FROM recording_analysis_requests
       WHERE tenant_id = $1 AND recording_id = $2
       ORDER BY created_at DESC`,
      [tenantId, recordingId],
    );
    return result.rows;
  }

  async findAnalysisRequest(id: string, tenantId: string): Promise<RecordingAnalysisRequest | null> {
    const result = await this.db.query<RecordingAnalysisRequest>(
      `SELECT id, tenant_id, recording_id, requested_outputs, language_hint, status, processor_id,
              claimed_at, language, transcript_text, summary_text, error_message, provider_metadata,
              metadata, created_at, completed_at
       FROM recording_analysis_requests
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async claimAnalysisRequest(id: string, input: ClaimRecordingAnalysisInput): Promise<RecordingAnalysisRequest | null> {
    const result = await this.db.query<RecordingAnalysisRequest>(
      `UPDATE recording_analysis_requests
       SET status = 'processing',
           processor_id = $2,
           claimed_at = NOW()
       WHERE id = $1 AND status = 'queued'
       RETURNING id, tenant_id, recording_id, requested_outputs, language_hint, status, processor_id,
                 claimed_at, language, transcript_text, summary_text, error_message, provider_metadata,
                 metadata, created_at, completed_at`,
      [id, input.processor_id ?? null],
    );
    return result.rows[0] ?? null;
  }

  async completeAnalysisRequest(id: string, input: CompleteRecordingAnalysisInput): Promise<RecordingAnalysisRequest | null> {
    const result = await this.db.query<RecordingAnalysisRequest>(
      `UPDATE recording_analysis_requests
       SET status = $2,
           language = $3,
           transcript_text = $4,
           summary_text = $5,
           error_message = LEFT($6, 500),
           provider_metadata = $7::jsonb,
           completed_at = NOW()
       WHERE id = $1 AND status IN ('queued', 'processing')
       RETURNING id, tenant_id, recording_id, requested_outputs, language_hint, status, processor_id,
                 claimed_at, language, transcript_text, summary_text, error_message, provider_metadata,
                 metadata, created_at, completed_at`,
      [
        id,
        input.status,
        input.language ?? null,
        input.transcript_text ?? null,
        input.summary_text ?? null,
        input.error_message ?? null,
        JSON.stringify(input.provider_metadata ?? {}),
      ],
    );
    return result.rows[0] ?? null;
  }

  // ── SLICE-47: Retention policy ────────────────────────────────────────────

  async getRetentionPolicy(tenantId: string): Promise<TenantRetentionPolicy | null> {
    const result = await this.db.query<TenantRetentionPolicy>(
      `SELECT id, tenant_id, recording_retention_days, transcript_retention_days,
              cdr_retention_days, created_at, updated_at
       FROM tenant_retention_policies
       WHERE tenant_id = $1`,
      [tenantId],
    );
    return result.rows[0] ?? null;
  }

  async upsertRetentionPolicy(tenantId: string, input: UpdateRetentionPolicyInput): Promise<TenantRetentionPolicy> {
    const result = await this.db.query<TenantRetentionPolicy>(
      `INSERT INTO tenant_retention_policies
         (tenant_id, recording_retention_days, transcript_retention_days, cdr_retention_days)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id) DO UPDATE
         SET recording_retention_days  = COALESCE($2, tenant_retention_policies.recording_retention_days),
             transcript_retention_days = COALESCE($3, tenant_retention_policies.transcript_retention_days),
             cdr_retention_days        = COALESCE($4, tenant_retention_policies.cdr_retention_days),
             updated_at                = NOW()
       RETURNING id, tenant_id, recording_retention_days, transcript_retention_days,
                 cdr_retention_days, created_at, updated_at`,
      [
        tenantId,
        input.recording_retention_days ?? null,
        input.transcript_retention_days ?? null,
        input.cdr_retention_days ?? null,
      ],
    );
    return result.rows[0]!;
  }

  // ── SLICE-47: Legal holds ─────────────────────────────────────────────────

  async createLegalHold(tenantId: string, initiatedBy: string, input: CreateLegalHoldInput): Promise<LegalHold> {
    const result = await this.db.query<LegalHold>(
      `INSERT INTO legal_hold_requests
         (tenant_id, resource_type, resource_id, initiated_by, case_reference, reason, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz)
       RETURNING id, tenant_id, resource_type, resource_id, initiated_by, case_reference, reason,
                 status, released_by, released_at, expires_at, created_at, updated_at`,
      [
        tenantId,
        input.resource_type,
        input.resource_id ?? null,
        initiatedBy,
        input.case_reference ?? null,
        input.reason,
        input.expires_at ?? null,
      ],
    );
    return result.rows[0]!;
  }

  async listLegalHolds(tenantId: string, filter: LegalHoldListFilter): Promise<LegalHold[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const values: unknown[] = [tenantId];
    let idx = 2;

    if (filter.resource_type) {
      conditions.push(`resource_type = $${idx++}`);
      values.push(filter.resource_type);
    }
    if (filter.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filter.status);
    }

    const result = await this.db.query<LegalHold>(
      `SELECT id, tenant_id, resource_type, resource_id, initiated_by, case_reference, reason,
              status, released_by, released_at, expires_at, created_at, updated_at
       FROM legal_hold_requests
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT 200`,
      values,
    );
    return result.rows;
  }

  async findLegalHold(id: string, tenantId: string): Promise<LegalHold | null> {
    const result = await this.db.query<LegalHold>(
      `SELECT id, tenant_id, resource_type, resource_id, initiated_by, case_reference, reason,
              status, released_by, released_at, expires_at, created_at, updated_at
       FROM legal_hold_requests
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async releaseLegalHold(id: string, tenantId: string, releasedBy: string): Promise<LegalHold | null> {
    const result = await this.db.query<LegalHold>(
      `UPDATE legal_hold_requests
       SET status = 'released',
           released_by = $3,
           released_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status = 'active'
       RETURNING id, tenant_id, resource_type, resource_id, initiated_by, case_reference, reason,
                 status, released_by, released_at, expires_at, created_at, updated_at`,
      [id, tenantId, releasedBy],
    );
    return result.rows[0] ?? null;
  }

  async hasActiveLegalHold(tenantId: string, resourceType: string, resourceId?: string): Promise<boolean> {
    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM legal_hold_requests
         WHERE tenant_id = $1
           AND status = 'active'
           AND (resource_type = 'all'
                OR resource_type = $2
                OR (resource_type = $2 AND ($3::text IS NULL OR resource_id = $3::text)))
       ) AS exists`,
      [tenantId, resourceType, resourceId ?? null],
    );
    return result.rows[0]?.exists ?? false;
  }
}
