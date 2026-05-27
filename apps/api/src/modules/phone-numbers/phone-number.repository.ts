import { Pool } from 'pg';
import type {
  CreatePhoneNumberInput,
  PhoneNumber,
  UpdatePhoneNumberInput,
} from './phone-number.types.js';

export class PhoneNumberRepository {
  constructor(private readonly db: Pool) {}

  private readonly publicColumns = `
    pn.id,
    pn.tenant_id,
    pn.e164_number,
    pn.display_label,
    pn.status,
    pn.trunk_id,
    pn.assigned_target_type,
    pn.assigned_target_id,
    pn.created_at,
    pn.updated_at
  `;

  async findAllByTenant(tenantId: string): Promise<PhoneNumber[]> {
    const result = await this.db.query<PhoneNumber>(
      `SELECT ${this.publicColumns}
       FROM phone_numbers pn
       WHERE pn.tenant_id = $1
       ORDER BY pn.e164_number ASC`,
      [tenantId],
    );
    return result.rows;
  }

  async findById(id: string, tenantId: string): Promise<PhoneNumber | null> {
    const result = await this.db.query<PhoneNumber>(
      `SELECT ${this.publicColumns}
       FROM phone_numbers pn
       WHERE pn.id = $1 AND pn.tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async create(input: CreatePhoneNumberInput): Promise<PhoneNumber> {
    const result = await this.db.query<PhoneNumber>(
      `INSERT INTO phone_numbers
         (tenant_id, e164_number, display_label, trunk_id)
       VALUES ($1, $2, $3, $4)
       RETURNING
         id, tenant_id, e164_number, display_label, status,
         trunk_id, assigned_target_type, assigned_target_id,
         created_at, updated_at`,
      [
        input.tenant_id,
        input.e164_number,
        input.display_label ?? null,
        input.trunk_id ?? null,
      ],
    );
    return result.rows[0]!;
  }

  async update(id: string, tenantId: string, input: UpdatePhoneNumberInput): Promise<PhoneNumber | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const updateable = [
      'display_label',
      'trunk_id',
      'assigned_target_type',
      'assigned_target_id',
      'status',
    ] as const;

    for (const col of updateable) {
      if (col in input) {
        fields.push(`${col} = $${idx++}`);
        values.push(input[col] ?? null);
      }
    }

    if (fields.length === 0) return this.findById(id, tenantId);

    fields.push(`updated_at = NOW()`);
    values.push(id, tenantId);

    const result = await this.db.query<PhoneNumber>(
      `UPDATE phone_numbers
       SET ${fields.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING
         id, tenant_id, e164_number, display_label, status,
         trunk_id, assigned_target_type, assigned_target_id,
         created_at, updated_at`,
      values,
    );
    return result.rows[0] ?? null;
  }

  async deactivate(id: string, tenantId: string): Promise<PhoneNumber | null> {
    const result = await this.db.query<PhoneNumber>(
      `UPDATE phone_numbers
       SET status = 'inactive', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING
         id, tenant_id, e164_number, display_label, status,
         trunk_id, assigned_target_type, assigned_target_id,
         created_at, updated_at`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }
}
