import type { Pool } from 'pg';
import type {
  CallingPolicy,
  CallingPolicyAssignment,
  CreateCallingPolicyInput,
  PolicyAssignableType,
  UpdateCallingPolicyInput,
} from './calling-policy.types.js';

const policyCols = `id, tenant_id, name, description, allow_local, allow_national, allow_mobile,
  allow_international, allow_premium_rate, allow_toll_free, allow_special, emergency_always_allowed,
  exceptions, status, created_at, updated_at`;

const assignCols = `id, tenant_id, policy_id, assignable_type, assignable_id, created_at`;

export class CallingPolicyRepository {
  constructor(private readonly db: Pool) {}

  async create(tenantId: string, input: CreateCallingPolicyInput): Promise<CallingPolicy> {
    const r = await this.db.query<CallingPolicy>(
      `INSERT INTO calling_policies
         (tenant_id, name, description, allow_local, allow_national, allow_mobile,
          allow_international, allow_premium_rate, allow_toll_free, allow_special,
          emergency_always_allowed, exceptions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
       RETURNING ${policyCols}`,
      [
        tenantId, input.name, input.description ?? null,
        input.allow_local ?? true, input.allow_national ?? true, input.allow_mobile ?? true,
        input.allow_international ?? false, input.allow_premium_rate ?? false,
        input.allow_toll_free ?? true, input.allow_special ?? false,
        input.emergency_always_allowed ?? true,
        JSON.stringify(input.exceptions ?? []),
      ],
    );
    return r.rows[0]!;
  }

  async findAll(tenantId: string): Promise<CallingPolicy[]> {
    const r = await this.db.query<CallingPolicy>(
      `SELECT ${policyCols} FROM calling_policies WHERE tenant_id = $1 ORDER BY name`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<CallingPolicy | null> {
    const r = await this.db.query<CallingPolicy>(
      `SELECT ${policyCols} FROM calling_policies WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async update(id: string, tenantId: string, input: UpdateCallingPolicyInput): Promise<CallingPolicy | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const vals: unknown[] = [id, tenantId];
    let i = 3;
    const add = (col: string, val: unknown, cast?: string) => {
      sets.push(`${col} = $${i}${cast ? '::' + cast : ''}`);
      vals.push(val); i++;
    };
    if (input.name !== undefined)                   add('name', input.name);
    if (input.description !== undefined)            add('description', input.description);
    if (input.allow_local !== undefined)            add('allow_local', input.allow_local);
    if (input.allow_national !== undefined)         add('allow_national', input.allow_national);
    if (input.allow_mobile !== undefined)           add('allow_mobile', input.allow_mobile);
    if (input.allow_international !== undefined)    add('allow_international', input.allow_international);
    if (input.allow_premium_rate !== undefined)     add('allow_premium_rate', input.allow_premium_rate);
    if (input.allow_toll_free !== undefined)        add('allow_toll_free', input.allow_toll_free);
    if (input.allow_special !== undefined)          add('allow_special', input.allow_special);
    if (input.emergency_always_allowed !== undefined) add('emergency_always_allowed', input.emergency_always_allowed);
    if (input.exceptions !== undefined)             add('exceptions', JSON.stringify(input.exceptions), 'jsonb');
    if (input.status !== undefined)                 add('status', input.status);

    const r = await this.db.query<CallingPolicy>(
      `UPDATE calling_policies SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING ${policyCols}`,
      vals,
    );
    return r.rows[0] ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM calling_policies WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async assign(tenantId: string, policyId: string, assignableType: PolicyAssignableType, assignableId: string | null): Promise<CallingPolicyAssignment> {
    const r = await this.db.query<CallingPolicyAssignment>(
      `INSERT INTO calling_policy_assignments (tenant_id, policy_id, assignable_type, assignable_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, assignable_type, COALESCE(assignable_id, '00000000-0000-0000-0000-000000000000'))
       DO UPDATE SET policy_id = EXCLUDED.policy_id
       RETURNING ${assignCols}`,
      [tenantId, policyId, assignableType, assignableId],
    );
    return r.rows[0]!;
  }

  async findTenantPolicy(tenantId: string): Promise<CallingPolicy | null> {
    const r = await this.db.query<CallingPolicy>(
      `SELECT cp.${policyCols.split(',').map(c => c.trim()).join(', cp.')}
       FROM calling_policies cp
       JOIN calling_policy_assignments cpa ON cpa.policy_id = cp.id AND cpa.tenant_id = cp.tenant_id
       WHERE cp.tenant_id = $1 AND cpa.assignable_type = 'tenant' AND cpa.assignable_id IS NULL
       LIMIT 1`,
      [tenantId],
    );
    return r.rows[0] ?? null;
  }
}
