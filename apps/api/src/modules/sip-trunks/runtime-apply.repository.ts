import type { Pool } from 'pg';
import type {
  ApplyResultInput,
  CreateApplyRequestInput,
  PendingApplyRequest,
  RuntimeApplyRequest,
} from './runtime-apply.types.js';

const COLS = `
  id, tenant_id, triggered_by_type, triggered_by_id,
  action_type, target_node_id, target_profile, target_gateway,
  object_type, object_id, status, active_call_count,
  applied_at, error_message, created_at, updated_at
`;

export class RuntimeApplyRepository {
  constructor(private readonly db: Pool) {}

  async create(input: CreateApplyRequestInput): Promise<RuntimeApplyRequest> {
    const r = await this.db.query<RuntimeApplyRequest>(
      `INSERT INTO runtime_apply_requests
         (tenant_id, triggered_by_type, triggered_by_id,
          action_type, target_node_id, target_profile, target_gateway,
          object_type, object_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${COLS}`,
      [
        input.tenant_id,
        input.triggered_by_type,
        input.triggered_by_id ?? null,
        input.action_type,
        input.target_node_id,
        input.target_profile ?? null,
        input.target_gateway ?? null,
        input.object_type,
        input.object_id,
      ],
    );
    return r.rows[0]!;
  }

  async findByTrunk(tenantId: string, trunkId: string, limit = 20): Promise<RuntimeApplyRequest[]> {
    const r = await this.db.query<RuntimeApplyRequest>(
      `SELECT ${COLS} FROM runtime_apply_requests
       WHERE tenant_id = $1 AND object_type = 'sip_trunk' AND object_id = $2
       ORDER BY created_at DESC LIMIT $3`,
      [tenantId, trunkId, limit],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<RuntimeApplyRequest | null> {
    const r = await this.db.query<RuntimeApplyRequest>(
      `SELECT ${COLS} FROM runtime_apply_requests
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  // Returns pending requests for a specific node (used by Go agent poll endpoint).
  async listPendingForNode(nodeId: string, limit = 10): Promise<PendingApplyRequest[]> {
    const r = await this.db.query<PendingApplyRequest>(
      `SELECT id, action_type, target_profile, target_gateway, object_type, object_id
       FROM runtime_apply_requests
       WHERE target_node_id = $1 AND status = 'pending'
       ORDER BY created_at ASC LIMIT $2`,
      [nodeId, limit],
    );
    return r.rows;
  }

  async claim(id: string, nodeId: string): Promise<RuntimeApplyRequest | null> {
    const r = await this.db.query<RuntimeApplyRequest>(
      `UPDATE runtime_apply_requests
       SET status = 'applying', updated_at = NOW()
       WHERE id = $1 AND target_node_id = $2 AND status = 'pending'
       RETURNING ${COLS}`,
      [id, nodeId],
    );
    return r.rows[0] ?? null;
  }

  async applyResult(id: string, nodeId: string, input: ApplyResultInput): Promise<RuntimeApplyRequest | null> {
    const r = await this.db.query<RuntimeApplyRequest>(
      `UPDATE runtime_apply_requests
       SET status = $3,
           error_message = $4,
           applied_at = CASE WHEN $3 = 'applied' THEN NOW() ELSE NULL END,
           updated_at = NOW()
       WHERE id = $1 AND target_node_id = $2 AND status = 'applying'
       RETURNING ${COLS}`,
      [id, nodeId, input.status, input.error_message ?? null],
    );
    return r.rows[0] ?? null;
  }

  // Returns active FreeSWITCH nodes to fan-out apply requests.
  async listActiveNodes(): Promise<{ id: string; display_name: string }[]> {
    const r = await this.db.query<{ id: string; display_name: string }>(
      `SELECT id, display_name FROM freeswitch_nodes
       WHERE status = 'active'
       ORDER BY display_name`,
    );
    return r.rows;
  }
}
