import type { Pool } from 'pg';
import type {
  CallDisposition,
  CallDispositionWithCode,
  CallNote,
  CreateDispositionCodeInput,
  DispositionCode,
  UpdateDispositionCodeInput,
} from './dispositions.types.js';

export class DispositionsRepository {
  constructor(private readonly db: Pool) {}

  // ── Disposition codes ──────────────────────────────────────────────────────

  async listCodes(tenantId: string, queueId?: string | null): Promise<DispositionCode[]> {
    const conditions = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let idx = 2;
    if (queueId !== undefined) {
      if (queueId === null) {
        conditions.push('queue_id IS NULL');
      } else {
        conditions.push(`queue_id = $${idx}`);
        params.push(queueId);
        idx++;
      }
    }
    const result = await this.db.query<DispositionCode>(
      `SELECT * FROM disposition_codes WHERE ${conditions.join(' AND ')} ORDER BY code`,
      params,
    );
    return result.rows;
  }

  async findCodeById(id: string, tenantId: string): Promise<DispositionCode | null> {
    const result = await this.db.query<DispositionCode>(
      'SELECT * FROM disposition_codes WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async codeExistsByCode(code: string, tenantId: string, excludeId?: string): Promise<boolean> {
    const params: unknown[] = [code, tenantId];
    let sql = 'SELECT 1 FROM disposition_codes WHERE code = $1 AND tenant_id = $2';
    if (excludeId) { sql += ` AND id != $3`; params.push(excludeId); }
    const result = await this.db.query(sql, params);
    return (result.rowCount ?? 0) > 0;
  }

  async createCode(input: CreateDispositionCodeInput): Promise<DispositionCode> {
    const result = await this.db.query<DispositionCode>(
      `INSERT INTO disposition_codes (tenant_id, code, label, description, queue_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.tenant_id, input.code, input.label, input.description ?? null, input.queue_id ?? null],
    );
    return result.rows[0]!;
  }

  async updateCode(id: string, tenantId: string, input: UpdateDispositionCodeInput): Promise<DispositionCode | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (input.label !== undefined)       { sets.push(`label = $${idx}`);       params.push(input.label);       idx++; }
    if (input.description !== undefined) { sets.push(`description = $${idx}`); params.push(input.description); idx++; }
    if (input.queue_id !== undefined)    { sets.push(`queue_id = $${idx}`);    params.push(input.queue_id);    idx++; }
    if (input.is_active !== undefined)   { sets.push(`is_active = $${idx}`);   params.push(input.is_active);   idx++; }
    if (sets.length === 0) return this.findCodeById(id, tenantId);
    sets.push(`updated_at = now()`);
    params.push(id, tenantId);
    const result = await this.db.query<DispositionCode>(
      `UPDATE disposition_codes SET ${sets.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING *`,
      params,
    );
    return result.rows[0] ?? null;
  }

  // ── Call dispositions ──────────────────────────────────────────────────────

  async findDispositionByCallId(callId: string, tenantId: string): Promise<CallDispositionWithCode | null> {
    const result = await this.db.query<CallDispositionWithCode>(
      `SELECT cd.*, dc.code, dc.label
       FROM call_dispositions cd
       JOIN disposition_codes dc ON dc.id = cd.disposition_code_id
       WHERE cd.call_id = $1 AND cd.tenant_id = $2`,
      [callId, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async listDispositionsByAgent(agentProfileId: string, tenantId: string, limit = 50): Promise<CallDispositionWithCode[]> {
    const result = await this.db.query<CallDispositionWithCode>(
      `SELECT cd.*, dc.code, dc.label
       FROM call_dispositions cd
       JOIN disposition_codes dc ON dc.id = cd.disposition_code_id
       WHERE cd.tenant_id = $1 AND cd.agent_profile_id = $2
       ORDER BY cd.created_at DESC LIMIT $3`,
      [tenantId, agentProfileId, limit],
    );
    return result.rows;
  }

  async upsertDisposition(
    tenantId: string,
    callId: string,
    dispositionCodeId: string,
    agentProfileId: string | null,
    recordedBy: string,
    note: string | null,
  ): Promise<CallDisposition> {
    const result = await this.db.query<CallDisposition>(
      `INSERT INTO call_dispositions (tenant_id, call_id, disposition_code_id, agent_profile_id, recorded_by, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, call_id)
       DO UPDATE SET
         disposition_code_id = EXCLUDED.disposition_code_id,
         agent_profile_id = EXCLUDED.agent_profile_id,
         recorded_by = EXCLUDED.recorded_by,
         note = EXCLUDED.note,
         updated_at = now()
       RETURNING *`,
      [tenantId, callId, dispositionCodeId, agentProfileId, recordedBy, note],
    );
    return result.rows[0]!;
  }

  // ── Call notes ─────────────────────────────────────────────────────────────

  async listNotesByCall(callId: string, tenantId: string): Promise<CallNote[]> {
    const result = await this.db.query<CallNote>(
      `SELECT * FROM call_notes WHERE call_id = $1 AND tenant_id = $2 ORDER BY created_at ASC`,
      [callId, tenantId],
    );
    return result.rows;
  }

  async findNoteById(id: string, tenantId: string): Promise<CallNote | null> {
    const result = await this.db.query<CallNote>(
      'SELECT * FROM call_notes WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async createNote(tenantId: string, callId: string, authorUserId: string, content: string): Promise<CallNote> {
    const result = await this.db.query<CallNote>(
      `INSERT INTO call_notes (tenant_id, call_id, author_user_id, content)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [tenantId, callId, authorUserId, content],
    );
    return result.rows[0]!;
  }

  async updateNote(id: string, tenantId: string, authorUserId: string, content: string): Promise<CallNote | null> {
    const result = await this.db.query<CallNote>(
      `UPDATE call_notes SET content = $1, updated_at = now()
       WHERE id = $2 AND tenant_id = $3 AND author_user_id = $4
       RETURNING *`,
      [content, id, tenantId, authorUserId],
    );
    return result.rows[0] ?? null;
  }

  async deleteNote(id: string, tenantId: string, authorUserId: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM call_notes WHERE id = $1 AND tenant_id = $2 AND author_user_id = $3',
      [id, tenantId, authorUserId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
