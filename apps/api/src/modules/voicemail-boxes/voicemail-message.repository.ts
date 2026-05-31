import type { Pool } from 'pg';
import type { CreateVoicemailMessageInput, VoicemailMessage } from './voicemail-message.types.js';

export class VoicemailMessageRepository {
  constructor(private readonly db: Pool) {}

  private readonly columns = `
    id,
    tenant_id,
    voicemail_box_id,
    call_id,
    storage_path,
    duration_secs,
    size_bytes,
    read_at,
    deleted_at,
    recorded_at,
    created_at
  `;

  async findMailboxRuntimeRef(
    boxId: string,
  ): Promise<{ id: string; tenant_id: string; status: string } | null> {
    const result = await this.db.query<{ id: string; tenant_id: string; status: string }>(
      `SELECT id, tenant_id, status
       FROM voicemail_boxes
       WHERE id = $1`,
      [boxId],
    );
    return result.rows[0] ?? null;
  }

  async create(input: CreateVoicemailMessageInput): Promise<VoicemailMessage> {
    const result = await this.db.query<VoicemailMessage>(
      `INSERT INTO voicemail_messages
         (tenant_id, voicemail_box_id, call_id, storage_path, duration_secs, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${this.columns}`,
      [
        input.tenant_id,
        input.voicemail_box_id,
        input.call_id,
        input.storage_path,
        input.duration_secs ?? null,
        input.size_bytes ?? null,
      ],
    );
    return result.rows[0]!;
  }

  async listByMailbox(
    tenantId: string,
    boxId: string,
    options: { unreadOnly: boolean; limit: number },
  ): Promise<VoicemailMessage[]> {
    const result = await this.db.query<VoicemailMessage>(
      `SELECT ${this.columns}
       FROM voicemail_messages
       WHERE tenant_id = $1
         AND voicemail_box_id = $2
         AND deleted_at IS NULL
         ${options.unreadOnly ? 'AND read_at IS NULL' : ''}
       ORDER BY recorded_at DESC
       LIMIT $3`,
      [tenantId, boxId, options.limit],
    );
    return result.rows;
  }

  async markRead(id: string, tenantId: string): Promise<VoicemailMessage | null> {
    const result = await this.db.query<VoicemailMessage>(
      `UPDATE voicemail_messages
       SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
       RETURNING ${this.columns}`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async softDelete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query<{ id: string }>(
      `UPDATE voicemail_messages
       SET deleted_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [id, tenantId],
    );
    return result.rows.length > 0;
  }
}
