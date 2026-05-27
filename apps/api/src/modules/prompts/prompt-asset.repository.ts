import type { Pool } from 'pg';
import type {
  CreatePromptAssetInput,
  PromptAsset,
  UpdatePromptAssetInput,
} from './prompt-asset.types.js';

export class PromptAssetRepository {
  constructor(private readonly db: Pool) {}

  private readonly publicColumns = `
    id,
    tenant_id,
    name,
    media_type,
    language,
    storage_uri,
    checksum,
    status,
    created_at,
    updated_at
  `;

  async findAllByTenant(tenantId: string): Promise<PromptAsset[]> {
    const result = await this.db.query<PromptAsset>(
      `SELECT ${this.publicColumns}
       FROM prompt_assets
       WHERE tenant_id = $1
       ORDER BY name ASC`,
      [tenantId],
    );
    return result.rows;
  }

  async findById(id: string, tenantId: string): Promise<PromptAsset | null> {
    const result = await this.db.query<PromptAsset>(
      `SELECT ${this.publicColumns}
       FROM prompt_assets
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async create(input: CreatePromptAssetInput): Promise<PromptAsset> {
    const result = await this.db.query<PromptAsset>(
      `INSERT INTO prompt_assets
         (tenant_id, name, media_type, language, storage_uri, checksum)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${this.publicColumns}`,
      [
        input.tenant_id,
        input.name,
        input.media_type,
        input.language ?? null,
        input.storage_uri,
        input.checksum ?? null,
      ],
    );
    return result.rows[0]!;
  }

  async update(id: string, tenantId: string, input: UpdatePromptAssetInput): Promise<PromptAsset | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const updateable = [
      'name',
      'media_type',
      'language',
      'storage_uri',
      'checksum',
      'status',
    ] as const;

    for (const column of updateable) {
      if (column in input) {
        fields.push(`${column} = $${idx++}`);
        values.push(input[column] ?? null);
      }
    }

    if (fields.length === 0) {
      return this.findById(id, tenantId);
    }

    fields.push('updated_at = NOW()');
    values.push(id, tenantId);

    const result = await this.db.query<PromptAsset>(
      `UPDATE prompt_assets
       SET ${fields.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING ${this.publicColumns}`,
      values,
    );
    return result.rows[0] ?? null;
  }

  async deactivate(id: string, tenantId: string): Promise<PromptAsset | null> {
    const result = await this.db.query<PromptAsset>(
      `UPDATE prompt_assets
       SET status = 'inactive', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING ${this.publicColumns}`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }
}
