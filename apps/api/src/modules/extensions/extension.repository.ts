import { Pool } from 'pg';
import type { Extension, CreateExtensionInput, UpdateExtensionInput } from './extension.types.js';

export class ExtensionRepository {
  constructor(private readonly db: Pool) {}

  async findAllByTenant(tenantId: string): Promise<Extension[]> {
    const result = await this.db.query<Extension>(
      'SELECT * FROM extensions WHERE tenant_id = $1 ORDER BY extension_number ASC',
      [tenantId],
    );
    return result.rows;
  }

  async findById(id: string, tenantId: string): Promise<Extension | null> {
    const result = await this.db.query<Extension>(
      'SELECT * FROM extensions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async findActiveByExtensionNumber(extensionNumber: string): Promise<Extension | null> {
    const result = await this.db.query<Extension>(
      `SELECT * FROM extensions
       WHERE extension_number = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [extensionNumber],
    );
    return result.rows[0] ?? null;
  }

  async create(input: CreateExtensionInput): Promise<Extension> {
    const result = await this.db.query<Extension>(
      `INSERT INTO extensions
         (tenant_id, extension_number, display_name, default_destination_type, default_destination_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.tenant_id,
        input.extension_number,
        input.display_name,
        input.default_destination_type ?? null,
        input.default_destination_id ?? null,
      ],
    );
    return result.rows[0]!;
  }

  async update(id: string, tenantId: string, input: UpdateExtensionInput): Promise<Extension | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const updateable = [
      'extension_number',
      'display_name',
      'status',
      'default_destination_type',
      'default_destination_id',
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

    const result = await this.db.query<Extension>(
      `UPDATE extensions SET ${fields.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING *`,
      values,
    );
    return result.rows[0] ?? null;
  }

  async deactivate(id: string, tenantId: string): Promise<Extension | null> {
    const result = await this.db.query<Extension>(
      `UPDATE extensions SET status = 'inactive', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }
}
