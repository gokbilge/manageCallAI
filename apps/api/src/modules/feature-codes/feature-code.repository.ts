import type { Pool } from 'pg';
import type {
  CreateFeatureCodeInput,
  FeatureCode,
  UpdateFeatureCodeInput,
} from './feature-code.types.js';

const COLS = `
  id, tenant_id, code, name, description,
  action_type, action_config, status, requires_approval,
  created_by, created_at, updated_at, published_at
`;

export class FeatureCodeRepository {
  constructor(private readonly db: Pool) {}

  async findAllByTenant(tenantId: string): Promise<FeatureCode[]> {
    const r = await this.db.query<FeatureCode>(
      `SELECT ${COLS} FROM feature_codes
       WHERE tenant_id = $1
       ORDER BY code ASC`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<FeatureCode | null> {
    const r = await this.db.query<FeatureCode>(
      `SELECT ${COLS} FROM feature_codes WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findByCode(code: string, tenantId: string): Promise<FeatureCode | null> {
    const r = await this.db.query<FeatureCode>(
      `SELECT ${COLS} FROM feature_codes WHERE code = $1 AND tenant_id = $2`,
      [code, tenantId],
    );
    return r.rows[0] ?? null;
  }

  // Returns all active codes for a tenant (used by the dialplan/runtime lookup).
  async findActiveByTenant(tenantId: string): Promise<FeatureCode[]> {
    const r = await this.db.query<FeatureCode>(
      `SELECT ${COLS} FROM feature_codes
       WHERE tenant_id = $1 AND status = 'active'
       ORDER BY code ASC`,
      [tenantId],
    );
    return r.rows;
  }

  async create(input: CreateFeatureCodeInput): Promise<FeatureCode> {
    const r = await this.db.query<FeatureCode>(
      `INSERT INTO feature_codes
         (tenant_id, code, name, description, action_type, action_config,
          requires_approval, created_by)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       RETURNING ${COLS}`,
      [
        input.tenant_id,
        input.code,
        input.name,
        input.description ?? null,
        input.action_type,
        JSON.stringify(input.action_config ?? {}),
        input.requires_approval ?? false,
        input.created_by ?? null,
      ],
    );
    return r.rows[0]!;
  }

  async update(id: string, tenantId: string, input: UpdateFeatureCodeInput): Promise<FeatureCode | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if ('description' in input) { fields.push(`description = $${idx++}`); values.push(input.description ?? null); }
    if (input.action_type !== undefined) { fields.push(`action_type = $${idx++}`); values.push(input.action_type); }
    if (input.action_config !== undefined) { fields.push(`action_config = $${idx++}::jsonb`); values.push(JSON.stringify(input.action_config)); }
    if (input.requires_approval !== undefined) { fields.push(`requires_approval = $${idx++}`); values.push(input.requires_approval); }

    if (fields.length === 0) return this.findById(id, tenantId);

    fields.push(`updated_at = NOW()`);
    values.push(id, tenantId);

    const r = await this.db.query<FeatureCode>(
      `UPDATE feature_codes
       SET ${fields.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1} AND status = 'draft'
       RETURNING ${COLS}`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async publish(id: string, tenantId: string): Promise<FeatureCode | null> {
    const r = await this.db.query<FeatureCode>(
      `UPDATE feature_codes
       SET status = 'active', published_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status = 'draft'
       RETURNING ${COLS}`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async disable(id: string, tenantId: string): Promise<FeatureCode | null> {
    const r = await this.db.query<FeatureCode>(
      `UPDATE feature_codes
       SET status = 'disabled', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status = 'active'
       RETURNING ${COLS}`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM feature_codes
       WHERE id = $1 AND tenant_id = $2 AND status IN ('draft', 'disabled')`,
      [id, tenantId],
    );
    return (r.rowCount ?? 0) > 0;
  }
}
