import { Pool } from 'pg';
import type {
  CreateExtensionRepoInput,
  DirectoryExtension,
  Extension,
  UpdateExtensionRepoInput,
} from './extension.types.js';

export class ExtensionRepository {
  constructor(private readonly db: Pool) {}

  private readonly publicColumns = `
    e.id,
    e.tenant_id,
    e.extension_number,
    e.display_name,
    e.status,
    e.sip_username,
    e.default_destination_type,
    e.default_destination_id,
    e.created_at,
    e.updated_at
  `;

  async findAllByTenant(tenantId: string): Promise<Extension[]> {
    const result = await this.db.query<Extension>(
      `SELECT ${this.publicColumns}
       FROM extensions e
       WHERE e.tenant_id = $1
       ORDER BY e.extension_number ASC`,
      [tenantId],
    );
    return result.rows;
  }

  async findById(id: string, tenantId: string): Promise<Extension | null> {
    const result = await this.db.query<Extension>(
      `SELECT ${this.publicColumns}
       FROM extensions e
       WHERE e.id = $1 AND e.tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async findActiveByDirectoryLookup(
    extensionNumber: string,
    domain: string,
  ): Promise<DirectoryExtension | null> {
    const result = await this.db.query<DirectoryExtension>(
      `SELECT
         ${this.publicColumns},
         e.sip_password_ciphertext,
         e.sip_password_key_id,
         t.directory_domain
       FROM extensions e
       JOIN tenants t ON t.id = e.tenant_id
       WHERE e.extension_number = $1
         AND e.status = 'active'
         AND LOWER(t.directory_domain) = LOWER($2)
       ORDER BY e.created_at DESC
       LIMIT 1`,
      [extensionNumber, domain],
    );
    return result.rows[0] ?? null;
  }

  async create(input: CreateExtensionRepoInput): Promise<Extension> {
    const result = await this.db.query<Extension>(
      `INSERT INTO extensions
         (tenant_id, extension_number, display_name, sip_username, sip_password_ciphertext, sip_password_key_id, default_destination_type, default_destination_id, owner_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
         -- Only set owner_user_id if the supplied ID exists in users (API-key auth passes key ID, not user ID).
         (SELECT id FROM users WHERE id = $9 LIMIT 1))
       RETURNING
         id,
         tenant_id,
         extension_number,
         display_name,
         status,
         sip_username,
         default_destination_type,
         default_destination_id,
         created_at,
         updated_at`,
      [
        input.tenant_id,
        input.extension_number,
        input.display_name,
        input.sip_username ?? input.extension_number,
        input.sip_password_ciphertext,
        input.sip_password_key_id,
        input.default_destination_type ?? null,
        input.default_destination_id ?? null,
        input.owner_user_id ?? null,
      ],
    );
    return result.rows[0]!;
  }

  async update(id: string, tenantId: string, input: UpdateExtensionRepoInput): Promise<Extension | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const updateable = [
      'extension_number',
      'display_name',
      'status',
      'sip_username',
      'sip_password_ciphertext',
      'sip_password_key_id',
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
      `UPDATE extensions
       SET ${fields.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING
         id,
         tenant_id,
         extension_number,
         display_name,
         status,
         sip_username,
         default_destination_type,
         default_destination_id,
         created_at,
         updated_at`,
      values,
    );
    return result.rows[0] ?? null;
  }

  async deactivate(id: string, tenantId: string): Promise<Extension | null> {
    const result = await this.db.query<Extension>(
      `UPDATE extensions SET status = 'inactive', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING
         id,
         tenant_id,
         extension_number,
         display_name,
         status,
         sip_username,
         default_destination_type,
         default_destination_id,
         created_at,
         updated_at`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }
}
