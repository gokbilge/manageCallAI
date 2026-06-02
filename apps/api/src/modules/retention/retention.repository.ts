import type { Pool } from 'pg';
import type {
  CreateLegalHoldInput,
  LegalHold,
  RetentionPolicy,
  UpdateRetentionPolicyInput,
} from './retention.types.js';

export class RetentionRepository {
  constructor(private readonly db: Pool) {}

  async getPolicy(tenantId: string): Promise<RetentionPolicy | null> {
    const r = await this.db.query<RetentionPolicy>(
      `SELECT tenant_id,
              recording_retention_days, voicemail_retention_days,
              transcript_retention_days, ai_summary_retention_days,
              cdr_retention_days, call_event_retention_days,
              generated_media_retention_days,
              created_at, updated_at
       FROM tenant_retention_policies WHERE tenant_id = $1`,
      [tenantId],
    );
    return r.rows[0] ?? null;
  }

  async upsertPolicy(tenantId: string, input: UpdateRetentionPolicyInput): Promise<RetentionPolicy> {
    const r = await this.db.query<RetentionPolicy>(
      `INSERT INTO tenant_retention_policies
         (tenant_id,
          recording_retention_days, voicemail_retention_days,
          transcript_retention_days, ai_summary_retention_days,
          cdr_retention_days, call_event_retention_days,
          generated_media_retention_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (tenant_id) DO UPDATE
         SET recording_retention_days      = COALESCE($2, tenant_retention_policies.recording_retention_days),
             voicemail_retention_days      = COALESCE($3, tenant_retention_policies.voicemail_retention_days),
             transcript_retention_days     = COALESCE($4, tenant_retention_policies.transcript_retention_days),
             ai_summary_retention_days     = COALESCE($5, tenant_retention_policies.ai_summary_retention_days),
             cdr_retention_days            = COALESCE($6, tenant_retention_policies.cdr_retention_days),
             call_event_retention_days     = COALESCE($7, tenant_retention_policies.call_event_retention_days),
             generated_media_retention_days = COALESCE($8, tenant_retention_policies.generated_media_retention_days),
             updated_at                    = NOW()
       RETURNING tenant_id,
                 recording_retention_days, voicemail_retention_days,
                 transcript_retention_days, ai_summary_retention_days,
                 cdr_retention_days, call_event_retention_days,
                 generated_media_retention_days,
                 created_at, updated_at`,
      [
        tenantId,
        input.recording_retention_days ?? null,
        input.voicemail_retention_days ?? null,
        input.transcript_retention_days ?? null,
        input.ai_summary_retention_days ?? null,
        input.cdr_retention_days ?? null,
        input.call_event_retention_days ?? null,
        input.generated_media_retention_days ?? null,
      ],
    );
    return r.rows[0]!;
  }

  async listLegalHolds(tenantId: string, activeOnly: boolean): Promise<LegalHold[]> {
    const r = await this.db.query<LegalHold>(
      `SELECT id, tenant_id, resource_type, resource_id,
              initiated_by, case_reference, reason,
              status, released_by, released_at, expires_at,
              created_at, updated_at
       FROM legal_hold_requests
       WHERE tenant_id = $1
         ${activeOnly ? "AND status = 'active'" : ''}
       ORDER BY created_at DESC`,
      [tenantId],
    );
    return r.rows;
  }

  async createLegalHold(tenantId: string, input: CreateLegalHoldInput): Promise<LegalHold> {
    const r = await this.db.query<LegalHold>(
      `INSERT INTO legal_hold_requests
         (tenant_id, resource_type, resource_id, initiated_by,
          case_reference, reason, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, tenant_id, resource_type, resource_id,
                 initiated_by, case_reference, reason,
                 status, released_by, released_at, expires_at,
                 created_at, updated_at`,
      [
        tenantId,
        input.resource_type,
        input.resource_id ?? null,
        input.initiated_by,
        input.case_reference ?? null,
        input.reason,
        input.expires_at ?? null,
      ],
    );
    return r.rows[0]!;
  }

  async releaseLegalHold(id: string, tenantId: string, releasedBy: string): Promise<LegalHold | null> {
    const r = await this.db.query<LegalHold>(
      `UPDATE legal_hold_requests
          SET status = 'released', released_by = $3, released_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND status = 'active'
       RETURNING id, tenant_id, resource_type, resource_id,
                 initiated_by, case_reference, reason,
                 status, released_by, released_at, expires_at,
                 created_at, updated_at`,
      [id, tenantId, releasedBy],
    );
    return r.rows[0] ?? null;
  }
}
