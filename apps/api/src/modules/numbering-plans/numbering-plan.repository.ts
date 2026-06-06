import type { Pool } from 'pg';
import type {
  AssignableType,
  CreateNumberingPlanInput,
  CreateNumberingRuleInput,
  NumberingPlan,
  NumberingPlanAssignment,
  NumberingPlanWithRules,
  NumberingRule,
  UpdateNumberingPlanInput,
} from './numbering-plan.types.js';

const planCols = `id, tenant_id, name, description, country_code, status, created_at, updated_at`;
const ruleCols = `id, tenant_id, plan_id, name, pattern, call_type, priority, description, created_at`;
const assignCols = `id, tenant_id, plan_id, assignable_type, assignable_id, created_at`;

export class NumberingPlanRepository {
  constructor(private readonly db: Pool) {}

  async create(tenantId: string, input: CreateNumberingPlanInput): Promise<NumberingPlan> {
    const r = await this.db.query<NumberingPlan>(
      `INSERT INTO numbering_plans (tenant_id, name, description, country_code)
       VALUES ($1, $2, $3, $4) RETURNING ${planCols}`,
      [tenantId, input.name, input.description ?? null, input.country_code ?? null],
    );
    return r.rows[0]!;
  }

  async findAll(tenantId: string): Promise<NumberingPlan[]> {
    const r = await this.db.query<NumberingPlan>(
      `SELECT ${planCols} FROM numbering_plans WHERE tenant_id = $1 ORDER BY name`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<NumberingPlanWithRules | null> {
    const [planR, rulesR] = await Promise.all([
      this.db.query<NumberingPlan>(
        `SELECT ${planCols} FROM numbering_plans WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId],
      ),
      this.db.query<NumberingRule>(
        `SELECT ${ruleCols} FROM numbering_rules WHERE plan_id = $1 AND tenant_id = $2 ORDER BY priority, name`,
        [id, tenantId],
      ),
    ]);
    if (!planR.rows[0]) return null;
    return { ...planR.rows[0], rules: rulesR.rows };
  }

  async update(id: string, tenantId: string, input: UpdateNumberingPlanInput): Promise<NumberingPlan | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const vals: unknown[] = [id, tenantId];
    let i = 3;
    if (input.name !== undefined)         { sets.push(`name = $${i}`);         vals.push(input.name);         i++; }
    if (input.description !== undefined)  { sets.push(`description = $${i}`);  vals.push(input.description);  i++; }
    if (input.country_code !== undefined) { sets.push(`country_code = $${i}`); vals.push(input.country_code); i++; }
    if (input.status !== undefined)       { sets.push(`status = $${i}`);       vals.push(input.status);       i++; }
    const r = await this.db.query<NumberingPlan>(
      `UPDATE numbering_plans SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING ${planCols}`,
      vals,
    );
    return r.rows[0] ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM numbering_plans WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async createRule(tenantId: string, planId: string, input: CreateNumberingRuleInput): Promise<NumberingRule> {
    const r = await this.db.query<NumberingRule>(
      `INSERT INTO numbering_rules (tenant_id, plan_id, name, pattern, call_type, priority, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${ruleCols}`,
      [tenantId, planId, input.name, input.pattern, input.call_type, input.priority ?? 100, input.description ?? null],
    );
    return r.rows[0]!;
  }

  async deleteRule(ruleId: string, planId: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM numbering_rules WHERE id = $1 AND plan_id = $2 AND tenant_id = $3`,
      [ruleId, planId, tenantId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async findRulesForPlan(planId: string, tenantId: string): Promise<NumberingRule[]> {
    const r = await this.db.query<NumberingRule>(
      `SELECT ${ruleCols} FROM numbering_rules WHERE plan_id = $1 AND tenant_id = $2 ORDER BY priority`,
      [planId, tenantId],
    );
    return r.rows;
  }

  async assign(tenantId: string, planId: string, assignableType: AssignableType, assignableId: string | null): Promise<NumberingPlanAssignment> {
    const r = await this.db.query<NumberingPlanAssignment>(
      `INSERT INTO numbering_plan_assignments (tenant_id, plan_id, assignable_type, assignable_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, assignable_type, COALESCE(assignable_id, '00000000-0000-0000-0000-000000000000'))
       DO UPDATE SET plan_id = EXCLUDED.plan_id
       RETURNING ${assignCols}`,
      [tenantId, planId, assignableType, assignableId],
    );
    return r.rows[0]!;
  }

  async findAssignment(tenantId: string, assignableType: AssignableType, assignableId: string | null): Promise<NumberingPlanAssignment | null> {
    const r = await this.db.query<NumberingPlanAssignment>(
      `SELECT ${assignCols} FROM numbering_plan_assignments
       WHERE tenant_id = $1 AND assignable_type = $2 AND assignable_id IS NOT DISTINCT FROM $3`,
      [tenantId, assignableType, assignableId],
    );
    return r.rows[0] ?? null;
  }

  async findTenantRules(tenantId: string): Promise<NumberingRule[]> {
    const r = await this.db.query<NumberingRule>(
      `SELECT nr.id, nr.tenant_id, nr.plan_id, nr.name, nr.pattern, nr.call_type, nr.priority, nr.description, nr.created_at
       FROM numbering_rules nr
       JOIN numbering_plan_assignments npa ON npa.plan_id = nr.plan_id AND npa.tenant_id = nr.tenant_id
       WHERE nr.tenant_id = $1 AND npa.assignable_type = 'tenant' AND npa.assignable_id IS NULL
       ORDER BY nr.priority`,
      [tenantId],
    );
    return r.rows;
  }
}
