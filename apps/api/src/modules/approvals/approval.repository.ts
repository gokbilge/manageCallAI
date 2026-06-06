import type { Pool } from 'pg';
import type {
  ApprovalRequestWithDetails,
  PendingPublishRecord,
  Policy,
} from './approval.types.js';

export class ApprovalRepository {
  constructor(private readonly db: Pool) {}

  async findPendingByTenant(tenantId: string): Promise<ApprovalRequestWithDetails[]> {
    const r = await this.db.query<ApprovalRequestWithDetails>(
      `SELECT
         ar.id, ar.tenant_id, ar.object_type, ar.object_id, ar.version_id,
         ar.requested_by, ar.status, ar.created_at, ar.metadata,
         f.name AS flow_name,
         pr.action_type
       FROM approval_requests ar
       LEFT JOIN ivr_flows f ON f.id = ar.object_id AND ar.object_type = 'ivr_flow'
       LEFT JOIN publish_records pr ON pr.approval_request_id = ar.id
       WHERE ar.tenant_id = $1 AND ar.status = 'pending'
       ORDER BY ar.created_at DESC`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<ApprovalRequestWithDetails | null> {
    const r = await this.db.query<ApprovalRequestWithDetails>(
      `SELECT
         ar.id, ar.tenant_id, ar.object_type, ar.object_id, ar.version_id,
         ar.requested_by, ar.status, ar.created_at, ar.metadata,
         f.name AS flow_name,
         pr.action_type
       FROM approval_requests ar
       LEFT JOIN ivr_flows f ON f.id = ar.object_id AND ar.object_type = 'ivr_flow'
       LEFT JOIN publish_records pr ON pr.approval_request_id = ar.id
       WHERE ar.id = $1 AND ar.tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findAssociatedPublishRecord(approvalRequestId: string): Promise<PendingPublishRecord | null> {
    const r = await this.db.query<PendingPublishRecord>(
      `SELECT id, object_id, version_id, action_type
       FROM publish_records
       WHERE approval_request_id = $1
       LIMIT 1`,
      [approvalRequestId],
    );
    return r.rows[0] ?? null;
  }

  async markApproved(id: string, tenantId: string, decisionBy: string): Promise<boolean> {
    const r = await this.db.query(
      `UPDATE approval_requests
       SET status = 'approved',
           decision_by = $3,
           decision_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status = 'pending'`,
      [id, tenantId, decisionBy],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async markRejected(id: string, tenantId: string, decisionBy: string): Promise<boolean> {
    const r = await this.db.query(
      `UPDATE approval_requests
       SET status = 'rejected',
           decision_by = $3,
           decision_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status = 'pending'`,
      [id, tenantId, decisionBy],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async updatePublishRecordResult(approvalRequestId: string, result: 'success' | 'failed'): Promise<void> {
    await this.db.query(
      `UPDATE publish_records SET result = $1 WHERE approval_request_id = $2`,
      [result, approvalRequestId],
    );
  }

  async writeAuditEvent(input: {
    tenant_id: string;
    actor_id: string;
    action: string;
    object_type: string;
    object_id: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO audit_events (tenant_id, actor_type, actor_id, action, object_type, object_id, metadata)
       VALUES ($1, 'user', $2, $3, $4, $5, $6)`,
      [input.tenant_id, input.actor_id, input.action, input.object_type, input.object_id, JSON.stringify(input.metadata ?? {})],
    );
  }

  async listPolicies(tenantId: string): Promise<Policy[]> {
    const r = await this.db.query<Policy>(
      `SELECT id, tenant_id, policy_type, status, rules, created_at
       FROM policies
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId],
    );
    return r.rows;
  }
}
