import type { Pool } from 'pg';
import type {
  CreateSupervisorControlInput,
  SupervisorControl,
  SupervisorControlStatus,
  UpdateSupervisorControlInput,
} from './supervisor-controls.types.js';

const COLS = `id, tenant_id, supervisor_user_id, control_type, target_call_id,
  status, audit_note, created_at, updated_at, ended_at`;

export class SupervisorControlsRepository {
  constructor(private readonly db: Pool) {}

  async findAllByTenant(tenantId: string): Promise<SupervisorControl[]> {
    const r = await this.db.query<SupervisorControl>(
      `SELECT ${COLS} FROM supervisor_controls WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<SupervisorControl | null> {
    const r = await this.db.query<SupervisorControl>(
      `SELECT ${COLS} FROM supervisor_controls WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async create(input: CreateSupervisorControlInput): Promise<SupervisorControl> {
    const r = await this.db.query<SupervisorControl>(
      `INSERT INTO supervisor_controls
         (tenant_id, supervisor_user_id, control_type, target_call_id, audit_note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${COLS}`,
      [
        input.tenant_id,
        input.supervisor_user_id,
        input.control_type,
        input.target_call_id,
        input.audit_note ?? null,
      ],
    );
    return r.rows[0]!;
  }

  async update(id: string, tenantId: string, input: UpdateSupervisorControlInput): Promise<SupervisorControl | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(input.status);
      if (input.status === 'ended') {
        fields.push(`ended_at = NOW()`);
      }
    }
    if ('audit_note' in input) {
      fields.push(`audit_note = $${idx++}`);
      values.push(input.audit_note ?? null);
    }

    if (fields.length === 0) return this.findById(id, tenantId);

    fields.push('updated_at = NOW()');
    values.push(id, tenantId);
    const r = await this.db.query<SupervisorControl>(
      `UPDATE supervisor_controls SET ${fields.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING ${COLS}`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async setStatus(id: string, tenantId: string, status: SupervisorControlStatus): Promise<SupervisorControl | null> {
    const endedClause = status === 'ended' ? ', ended_at = NOW()' : '';
    const r = await this.db.query<SupervisorControl>(
      `UPDATE supervisor_controls SET status = $1${endedClause}, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING ${COLS}`,
      [status, id, tenantId],
    );
    return r.rows[0] ?? null;
  }
}
