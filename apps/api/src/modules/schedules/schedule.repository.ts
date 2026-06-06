import type { Pool } from 'pg';
import type {
  CancelScheduleOverrideInput,
  CreateHolidayCalendarInput,
  CreateScheduleGroupInput,
  CreateScheduleInput,
  CreateScheduleOverrideInput,
  HolidayCalendar,
  Schedule,
  ScheduleGroup,
  ScheduleOverrideRecord,
  UpdateHolidayCalendarInput,
  UpdateScheduleGroupInput,
  UpdateScheduleInput,
} from './schedule.types.js';

const SCHEDULE_COLUMNS =
  `id, tenant_id, name, status, timezone, schedule_group_id, holiday_calendar_id, weekly_rules_json, holiday_overrides_json, created_at, updated_at`;
const GROUP_COLUMNS =
  `id, tenant_id, name, description, status, weekly_rules_json, created_at, updated_at`;
const CALENDAR_COLUMNS =
  `id, tenant_id, name, description, status, entries_json, created_at, updated_at`;
const OVERRIDE_COLUMNS =
  `id, tenant_id, schedule_id, name, reason, mode, open_time, close_time, starts_at, ends_at, cancelled_at, cancelled_by, created_by, created_at, updated_at`;

export class ScheduleRepository {
  constructor(private readonly db: Pool) {}

  async findAllByTenant(tenantId: string): Promise<Schedule[]> {
    const r = await this.db.query<Schedule>(
      `SELECT ${SCHEDULE_COLUMNS} FROM schedules WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<Schedule | null> {
    const r = await this.db.query<Schedule>(
      `SELECT ${SCHEDULE_COLUMNS} FROM schedules WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async create(input: CreateScheduleInput): Promise<Schedule> {
    const r = await this.db.query<Schedule>(
      `INSERT INTO schedules (
         tenant_id, name, timezone, schedule_group_id, holiday_calendar_id, weekly_rules_json, holiday_overrides_json
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
       RETURNING ${SCHEDULE_COLUMNS}`,
      [
        input.tenant_id,
        input.name,
        input.timezone,
        input.schedule_group_id ?? null,
        input.holiday_calendar_id ?? null,
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

    if (input.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(input.name);
    }
    if (input.timezone !== undefined) {
      fields.push(`timezone = $${idx++}`);
      values.push(input.timezone);
    }
    if (input.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(input.status);
    }
    if (input.schedule_group_id !== undefined) {
      fields.push(`schedule_group_id = $${idx++}`);
      values.push(input.schedule_group_id);
    }
    if (input.holiday_calendar_id !== undefined) {
      fields.push(`holiday_calendar_id = $${idx++}`);
      values.push(input.holiday_calendar_id);
    }
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
      `UPDATE schedules
          SET ${fields.join(', ')}
        WHERE id = $${idx} AND tenant_id = $${idx + 1}
        RETURNING ${SCHEDULE_COLUMNS}`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async deactivate(id: string, tenantId: string): Promise<Schedule | null> {
    const r = await this.db.query<Schedule>(
      `UPDATE schedules
          SET status = 'inactive', updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING ${SCHEDULE_COLUMNS}`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findActiveByIds(tenantId: string, ids: string[]): Promise<Map<string, Schedule>> {
    if (ids.length === 0) return new Map();
    const r = await this.db.query<Schedule>(
      `SELECT ${SCHEDULE_COLUMNS}
         FROM schedules
        WHERE tenant_id = $1 AND status = 'active' AND id = ANY($2)`,
      [tenantId, ids],
    );
    return new Map(r.rows.map((s) => [s.id, s]));
  }

  async findScheduleGroupById(id: string, tenantId: string): Promise<ScheduleGroup | null> {
    const r = await this.db.query<ScheduleGroup>(
      `SELECT ${GROUP_COLUMNS} FROM schedule_groups WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findAllScheduleGroupsByTenant(tenantId: string): Promise<ScheduleGroup[]> {
    const r = await this.db.query<ScheduleGroup>(
      `SELECT ${GROUP_COLUMNS} FROM schedule_groups WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return r.rows;
  }

  async createScheduleGroup(input: CreateScheduleGroupInput): Promise<ScheduleGroup> {
    const r = await this.db.query<ScheduleGroup>(
      `INSERT INTO schedule_groups (tenant_id, name, description, status, weekly_rules_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING ${GROUP_COLUMNS}`,
      [
        input.tenant_id,
        input.name,
        input.description ?? null,
        input.status ?? 'active',
        JSON.stringify(input.weekly_rules_json),
      ],
    );
    return r.rows[0]!;
  }

  async updateScheduleGroup(id: string, tenantId: string, input: UpdateScheduleGroupInput): Promise<ScheduleGroup | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(input.description);
    }
    if (input.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(input.status);
    }
    if (input.weekly_rules_json !== undefined) {
      fields.push(`weekly_rules_json = $${idx++}::jsonb`);
      values.push(JSON.stringify(input.weekly_rules_json));
    }

    if (fields.length === 0) {
      return this.findScheduleGroupById(id, tenantId);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id, tenantId);

    const r = await this.db.query<ScheduleGroup>(
      `UPDATE schedule_groups
          SET ${fields.join(', ')}
        WHERE id = $${idx} AND tenant_id = $${idx + 1}
        RETURNING ${GROUP_COLUMNS}`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async syncSchedulesForGroup(groupId: string, tenantId: string, weeklyRulesJson: unknown): Promise<void> {
    await this.db.query(
      `UPDATE schedules
          SET weekly_rules_json = $1::jsonb,
              updated_at = NOW()
        WHERE tenant_id = $2 AND schedule_group_id = $3`,
      [JSON.stringify(weeklyRulesJson), tenantId, groupId],
    );
  }

  async findHolidayCalendarById(id: string, tenantId: string): Promise<HolidayCalendar | null> {
    const r = await this.db.query<HolidayCalendar>(
      `SELECT ${CALENDAR_COLUMNS} FROM holiday_calendars WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findAllHolidayCalendarsByTenant(tenantId: string): Promise<HolidayCalendar[]> {
    const r = await this.db.query<HolidayCalendar>(
      `SELECT ${CALENDAR_COLUMNS} FROM holiday_calendars WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return r.rows;
  }

  async createHolidayCalendar(input: CreateHolidayCalendarInput): Promise<HolidayCalendar> {
    const r = await this.db.query<HolidayCalendar>(
      `INSERT INTO holiday_calendars (tenant_id, name, description, status, entries_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING ${CALENDAR_COLUMNS}`,
      [
        input.tenant_id,
        input.name,
        input.description ?? null,
        input.status ?? 'active',
        JSON.stringify(input.entries_json),
      ],
    );
    return r.rows[0]!;
  }

  async updateHolidayCalendar(id: string, tenantId: string, input: UpdateHolidayCalendarInput): Promise<HolidayCalendar | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(input.description);
    }
    if (input.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(input.status);
    }
    if (input.entries_json !== undefined) {
      fields.push(`entries_json = $${idx++}::jsonb`);
      values.push(JSON.stringify(input.entries_json));
    }

    if (fields.length === 0) {
      return this.findHolidayCalendarById(id, tenantId);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id, tenantId);

    const r = await this.db.query<HolidayCalendar>(
      `UPDATE holiday_calendars
          SET ${fields.join(', ')}
        WHERE id = $${idx} AND tenant_id = $${idx + 1}
        RETURNING ${CALENDAR_COLUMNS}`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async syncSchedulesForHolidayCalendar(calendarId: string, tenantId: string, entriesJson: unknown): Promise<void> {
    await this.db.query(
      `UPDATE schedules
          SET holiday_overrides_json = $1::jsonb,
              updated_at = NOW()
        WHERE tenant_id = $2 AND holiday_calendar_id = $3`,
      [JSON.stringify(entriesJson), tenantId, calendarId],
    );
  }

  async findOverridesBySchedule(scheduleId: string, tenantId: string): Promise<ScheduleOverrideRecord[]> {
    const r = await this.db.query<ScheduleOverrideRecord>(
      `SELECT ${OVERRIDE_COLUMNS}
         FROM schedule_overrides
        WHERE schedule_id = $1 AND tenant_id = $2
        ORDER BY starts_at DESC, created_at DESC`,
      [scheduleId, tenantId],
    );
    return r.rows;
  }

  async findOverrideById(id: string, scheduleId: string, tenantId: string): Promise<ScheduleOverrideRecord | null> {
    const r = await this.db.query<ScheduleOverrideRecord>(
      `SELECT ${OVERRIDE_COLUMNS}
         FROM schedule_overrides
        WHERE id = $1 AND schedule_id = $2 AND tenant_id = $3`,
      [id, scheduleId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findOverlappingOverrides(scheduleId: string, tenantId: string, startsAt: Date, endsAt: Date): Promise<ScheduleOverrideRecord[]> {
    const r = await this.db.query<ScheduleOverrideRecord>(
      `SELECT ${OVERRIDE_COLUMNS}
         FROM schedule_overrides
        WHERE schedule_id = $1
          AND tenant_id = $2
          AND cancelled_at IS NULL
          AND starts_at < $4
          AND ends_at > $3`,
      [scheduleId, tenantId, startsAt, endsAt],
    );
    return r.rows;
  }

  async createOverride(input: CreateScheduleOverrideInput): Promise<ScheduleOverrideRecord> {
    const r = await this.db.query<ScheduleOverrideRecord>(
      `INSERT INTO schedule_overrides (
         tenant_id, schedule_id, name, reason, mode, open_time, close_time, starts_at, ends_at, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${OVERRIDE_COLUMNS}`,
      [
        input.tenant_id,
        input.schedule_id,
        input.name,
        input.reason ?? null,
        input.mode,
        input.open_time ?? null,
        input.close_time ?? null,
        input.starts_at,
        input.ends_at,
        input.created_by ?? null,
      ],
    );
    return r.rows[0]!;
  }

  async cancelOverride(id: string, scheduleId: string, tenantId: string, input: CancelScheduleOverrideInput): Promise<ScheduleOverrideRecord | null> {
    const r = await this.db.query<ScheduleOverrideRecord>(
      `UPDATE schedule_overrides
          SET cancelled_at = NOW(),
              cancelled_by = $1,
              reason = COALESCE($2, reason),
              updated_at = NOW()
        WHERE id = $3
          AND schedule_id = $4
          AND tenant_id = $5
          AND cancelled_at IS NULL
        RETURNING ${OVERRIDE_COLUMNS}`,
      [input.cancelled_by ?? null, input.reason ?? null, id, scheduleId, tenantId],
    );
    return r.rows[0] ?? null;
  }
}
