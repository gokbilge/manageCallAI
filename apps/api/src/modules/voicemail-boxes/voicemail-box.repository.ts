import type { Pool } from 'pg';
import type {
  CreateVoicemailBoxInput,
  UpdateVoicemailBoxInput,
  VoicemailBox,
} from './voicemail-box.types.js';

export class VoicemailBoxRepository {
  constructor(private readonly db: Pool) {}

  private readonly selectClause = `
    SELECT
      vb.id,
      vb.tenant_id,
      vb.name,
      vb.description,
      vb.mailbox_number,
      vb.greeting_prompt_id,
      pa.name AS greeting_prompt_name,
      pa.storage_uri AS greeting_prompt_uri,
      vb.status,
      vb.created_at,
      vb.updated_at
    FROM voicemail_boxes vb
    LEFT JOIN prompt_assets pa ON pa.id = vb.greeting_prompt_id
  `;

  async findAllByTenant(tenantId: string): Promise<VoicemailBox[]> {
    const r = await this.db.query<VoicemailBox>(
      `${this.selectClause}
       WHERE vb.tenant_id = $1
       ORDER BY vb.created_at DESC`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<VoicemailBox | null> {
    const r = await this.db.query<VoicemailBox>(
      `${this.selectClause}
       WHERE vb.id = $1 AND vb.tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async create(input: CreateVoicemailBoxInput): Promise<VoicemailBox> {
    const created = await this.db.query<{ id: string }>(
      `INSERT INTO voicemail_boxes (tenant_id, name, description, mailbox_number, greeting_prompt_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        input.tenant_id,
        input.name,
        input.description ?? null,
        input.mailbox_number,
        input.greeting_prompt_id ?? null,
      ],
    );
    return (await this.findById(created.rows[0]!.id, input.tenant_id))!;
  }

  async update(id: string, tenantId: string, input: UpdateVoicemailBoxInput): Promise<VoicemailBox | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if ('description' in input) { fields.push(`description = $${idx++}`); values.push(input.description ?? null); }
    if (input.mailbox_number !== undefined) { fields.push(`mailbox_number = $${idx++}`); values.push(input.mailbox_number); }
    if ('greeting_prompt_id' in input) { fields.push(`greeting_prompt_id = $${idx++}`); values.push(input.greeting_prompt_id ?? null); }
    if (input.status !== undefined) { fields.push(`status = $${idx++}`); values.push(input.status); }

    if (fields.length === 0) {
      return this.findById(id, tenantId);
    }

    fields.push('updated_at = NOW()');
    values.push(id, tenantId);
    const r = await this.db.query<{ id: string }>(
      `UPDATE voicemail_boxes SET ${fields.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING id`,
      values,
    );
    if (!r.rows[0]) return null;
    return this.findById(r.rows[0]!.id, tenantId);
  }

  async deactivate(id: string, tenantId: string): Promise<VoicemailBox | null> {
    return this.update(id, tenantId, { status: 'inactive' });
  }

  async findActivePrompt(promptId: string, tenantId: string): Promise<{ id: string; storage_uri: string | null } | null> {
    const r = await this.db.query<{ id: string; storage_uri: string | null }>(
      `SELECT id, storage_uri
       FROM prompt_assets
       WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
      [promptId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async isActiveTarget(id: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query<{ id: string }>(
      `SELECT id FROM voicemail_boxes WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
      [id, tenantId],
    );
    return r.rows.length > 0;
  }
}
