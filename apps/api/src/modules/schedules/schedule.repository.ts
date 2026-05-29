import type { Pool } from 'pg';
import type { CreateScheduleInput, Schedule, UpdateScheduleInput } from './schedule.types.js';

const COLUMNS = `id, tenant_id, name, status, timezone, weekly_rules_json, holiday_overrides_json, created_at, updated_at`;

export class ScheduleRepository {
  constructor(private readonly db: Pool) {}

  async findAllByTenant(tenantId: string): Promise<Schedule[]> {
    const r = await this.db.query<Schedule>(
      `SELECT ${COLUMNS} FROM schedules WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<Schedule | null> {
    const r = await this.db.query<Schedule>(
      `SELECT ${COLUMNS} FROM schedules WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async create(input: CreateScheduleInput): Promise<Schedule> {
    const r = await this.db.query<Schedule>(
      `INSERT INTO schedules (tenant_id, name, timezone, weekly_rules_json, holiday_overrides_json)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
       RETURNING ${COLUMNS}`,
      [
        input.tenant_id,
        input.name,
        input.timezone,
        JSON.stringify(input.weekly_rules_json ?? []),
        JSON.stringify(input.holiday_overrides_json ?? []),
      ],
    );
    return r.rows[0]!;
  }

  async update(id: string, tenantId: string, input: UpdateScheduleInput): Promise<Schedule | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if (input.timezone !== undefined) { fields.push(`timezone = $${idx++}`); values.push(input.timezone); }
    if (input.status !== undefined) { fields.push(`status = $${idx++}`); values.push(input.status); }
    if (input.weekly_rules_json !== undefined) {
      fields.push(`weekly_rules_json = $${idx++}::jsonb`);
      values.push(JSON.stringify(input.weekly_rules_json));
    }
    if (input.holiday_overrides_json !== undefined) {
      fields.push(`holiday_overrides_json = $${idx++}::jsonb`);
      values.push(JSON.stringify(input.holiday_overrides_json));
    }

    if (fields.length === 0) {
      return this.findById(id, tenantId);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id, tenantId);

    const r = await this.db.query<Schedule>(
      `UPDATE schedules SET ${fields.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING ${COLUMNS}`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async deactivate(id: string, tenantId: string): Promise<Schedule | null> {
    const r = await this.db.query<Schedule>(
      `UPDATE schedules SET status = 'inactive', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING ${COLUMNS}`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findActiveByIds(tenantId: string, ids: string[]): Promise<Map<string, Schedule>> {
    if (ids.length === 0) return new Map();
    const r = await this.db.query<Schedule>(
      `SELECT ${COLUMNS} FROM schedules WHERE tenant_id = $1 AND status = 'active' AND id = ANY($2)`,
      [tenantId, ids],
    );
    return new Map(r.rows.map((s) => [s.id, s]));
  }
}
