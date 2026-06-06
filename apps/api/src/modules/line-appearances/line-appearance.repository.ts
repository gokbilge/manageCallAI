import type { Pool } from 'pg';
import type {
  AssignAppearanceInput,
  DeviceAppearanceAssignment,
  LineAppearance,
  UpdateLineAppearanceInput,
} from './line-appearance.types.js';

const laCols = `id, tenant_id, extension_id, label, appearance_index, status, metadata, created_at, updated_at`;
const daaCols = `id, tenant_id, device_id, line_appearance_id, button_index, created_at`;

export class LineAppearanceRepository {
  constructor(private readonly db: Pool) {}

  // ── Line appearances (#314) ───────────────────────────────────────────────

  async create(
    tenantId: string,
    extensionId: string,
    label: string,
    appearanceIndex: number,
    metadata: Record<string, unknown>,
  ): Promise<LineAppearance> {
    const r = await this.db.query<LineAppearance>(
      `INSERT INTO line_appearances (tenant_id, extension_id, label, appearance_index, metadata)
       VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING ${laCols}`,
      [tenantId, extensionId, label, appearanceIndex, JSON.stringify(metadata)],
    );
    return r.rows[0]!;
  }

  async findAll(tenantId: string, extensionId?: string): Promise<LineAppearance[]> {
    if (extensionId) {
      const r = await this.db.query<LineAppearance>(
        `SELECT ${laCols} FROM line_appearances WHERE tenant_id = $1 AND extension_id = $2 ORDER BY appearance_index`,
        [tenantId, extensionId],
      );
      return r.rows;
    }
    const r = await this.db.query<LineAppearance>(
      `SELECT ${laCols} FROM line_appearances WHERE tenant_id = $1 ORDER BY extension_id, appearance_index`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<LineAppearance | null> {
    const r = await this.db.query<LineAppearance>(
      `SELECT ${laCols} FROM line_appearances WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async update(id: string, tenantId: string, input: UpdateLineAppearanceInput): Promise<LineAppearance | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const vals: unknown[] = [id, tenantId];
    let i = 3;
    if (input.label !== undefined)            { sets.push(`label = $${i}`);            vals.push(input.label);            i++; }
    if (input.appearance_index !== undefined) { sets.push(`appearance_index = $${i}`); vals.push(input.appearance_index); i++; }
    if (input.status !== undefined)           { sets.push(`status = $${i}`);           vals.push(input.status);           i++; }
    if (input.metadata !== undefined)         { sets.push(`metadata = $${i}::jsonb`);  vals.push(JSON.stringify(input.metadata)); i++; }
    const r = await this.db.query<LineAppearance>(
      `UPDATE line_appearances SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING ${laCols}`,
      vals,
    );
    return r.rows[0] ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM line_appearances WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  // ── Device appearance assignments (#315) ──────────────────────────────────

  async assignToDevice(tenantId: string, input: AssignAppearanceInput): Promise<DeviceAppearanceAssignment> {
    const r = await this.db.query<DeviceAppearanceAssignment>(
      `INSERT INTO device_appearance_assignments (tenant_id, device_id, line_appearance_id, button_index)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (tenant_id, device_id, line_appearance_id) DO UPDATE SET button_index = EXCLUDED.button_index
       RETURNING ${daaCols}`,
      [tenantId, input.device_id, input.line_appearance_id, input.button_index],
    );
    return r.rows[0]!;
  }

  async removeFromDevice(id: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM device_appearance_assignments WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async listByDevice(tenantId: string, deviceId: string): Promise<DeviceAppearanceAssignment[]> {
    const r = await this.db.query<DeviceAppearanceAssignment>(
      `SELECT ${daaCols} FROM device_appearance_assignments WHERE tenant_id = $1 AND device_id = $2 ORDER BY button_index`,
      [tenantId, deviceId],
    );
    return r.rows;
  }

  async listByAppearance(tenantId: string, lineAppearanceId: string): Promise<DeviceAppearanceAssignment[]> {
    const r = await this.db.query<DeviceAppearanceAssignment>(
      `SELECT ${daaCols} FROM device_appearance_assignments WHERE tenant_id = $1 AND line_appearance_id = $2 ORDER BY button_index`,
      [tenantId, lineAppearanceId],
    );
    return r.rows;
  }
}
