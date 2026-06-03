import type { Pool } from 'pg';
import type {
  ExtensionSelfServiceState,
  SelfServicePolicy,
  UpdateSelfServicePolicyInput,
} from './self-service.types.js';

const POLICY_COLS = `
  id, tenant_id, voicemail_view, voicemail_pin_change, dnd_manage,
  call_forward_manage, call_forward_set_target, call_history_view,
  created_at, updated_at
`;

export class SelfServiceRepository {
  constructor(private readonly db: Pool) {}

  // Extension lookup by user sub (JWT sub = user.id → extensions.owner_user_id)
  async findExtensionByUserId(userId: string, tenantId: string): Promise<ExtensionSelfServiceState | null> {
    const r = await this.db.query<ExtensionSelfServiceState>(
      `SELECT id, extension_number, display_name, dnd_enabled, call_forward_enabled, call_forward_target
       FROM extensions
       WHERE owner_user_id = $1 AND tenant_id = $2 AND status = 'active'
       LIMIT 1`,
      [userId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async setDnd(extensionId: string, tenantId: string, enabled: boolean): Promise<ExtensionSelfServiceState | null> {
    const r = await this.db.query<ExtensionSelfServiceState>(
      `UPDATE extensions
       SET dnd_enabled = $3, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, extension_number, display_name, dnd_enabled, call_forward_enabled, call_forward_target`,
      [extensionId, tenantId, enabled],
    );
    return r.rows[0] ?? null;
  }

  async setCallForward(
    extensionId: string,
    tenantId: string,
    enabled: boolean,
    target?: string | null,
  ): Promise<ExtensionSelfServiceState | null> {
    const r = await this.db.query<ExtensionSelfServiceState>(
      `UPDATE extensions
       SET call_forward_enabled = $3,
           call_forward_target = COALESCE($4, call_forward_target),
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, extension_number, display_name, dnd_enabled, call_forward_enabled, call_forward_target`,
      [extensionId, tenantId, enabled, target ?? null],
    );
    return r.rows[0] ?? null;
  }

  // Policy CRUD
  async findPolicy(tenantId: string): Promise<SelfServicePolicy | null> {
    const r = await this.db.query<SelfServicePolicy>(
      `SELECT ${POLICY_COLS} FROM end_user_self_service_policies WHERE tenant_id = $1`,
      [tenantId],
    );
    return r.rows[0] ?? null;
  }

  async upsertPolicy(tenantId: string, input: UpdateSelfServicePolicyInput): Promise<SelfServicePolicy> {
    const fields = Object.entries(input).filter(([, v]) => v !== undefined);
    const setClauses = fields.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const values = fields.map(([, v]) => v);

    if (fields.length === 0) {
      // No-op update — just ensure row exists
      const r = await this.db.query<SelfServicePolicy>(
        `INSERT INTO end_user_self_service_policies (tenant_id)
         VALUES ($1)
         ON CONFLICT (tenant_id) DO UPDATE SET updated_at = NOW()
         RETURNING ${POLICY_COLS}`,
        [tenantId],
      );
      return r.rows[0]!;
    }

    const r = await this.db.query<SelfServicePolicy>(
      `INSERT INTO end_user_self_service_policies (tenant_id, ${fields.map(([k]) => k).join(', ')})
       VALUES ($1, ${fields.map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (tenant_id) DO UPDATE SET
         ${setClauses}, updated_at = NOW()
       RETURNING ${POLICY_COLS}`,
      [tenantId, ...values],
    );
    return r.rows[0]!;
  }
}
