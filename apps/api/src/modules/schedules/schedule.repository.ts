import type { Pool } from 'pg';
import type {
  CreateHolidayCalendarInput,
  CreateScheduleInput,
  CreateScheduleOverrideInput,
  HolidayCalendar,
  Schedule,
  ScheduleOverride,
  UpdateHolidayCalendarInput,
  UpdateScheduleInput,
  UpdateScheduleOverrideInput,
} from './schedule.types.js';

const SCHEDULE_COLUMNS = `
  s.id,
  s.tenant_id,
  s.name,
  s.description,
  s.status,
  s.timezone,
  s.weekly_rules_json,
  s.holiday_overrides_json,
  s.created_at,
  s.updated_at
`;

const HOLIDAY_CALENDAR_COLUMNS = `
  id,
  tenant_id,
  schedule_id,
  name,
  description,
  status,
  entries_json,
  created_at,
  updated_at
`;

const SCHEDULE_OVERRIDE_COLUMNS = `
  id,
  tenant_id,
  schedule_id,
  name,
  reason,
  CASE
    WHEN status = 'active' AND ends_at <= NOW() THEN 'expired'
    ELSE status
  END AS status,
  starts_at,
  ends_at,
  closed,
  open_time,
  close_time,
  cancelled_at,
  cancelled_by,
  created_by,
  created_at,
  updated_at
`;

type ScheduleRow = Omit<Schedule, 'holiday_calendars' | 'temporary_overrides'>;

export class ScheduleRepository {
  constructor(private readonly db: Pool) {}

  async findAllByTenant(tenantId: string): Promise<Schedule[]> {
    const scheduleRows = await this.db.query<ScheduleRow>(
      `SELECT ${SCHEDULE_COLUMNS}
       FROM schedules s
       WHERE s.tenant_id = $1
       ORDER BY s.created_at DESC`,
      [tenantId],
    );
    return this.hydrateSchedules(tenantId, scheduleRows.rows);
  }

  async findById(id: string, tenantId: string): Promise<Schedule | null> {
    const scheduleRows = await this.db.query<ScheduleRow>(
      `SELECT ${SCHEDULE_COLUMNS}
       FROM schedules s
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [id, tenantId],
    );
    if (!scheduleRows.rows[0]) {
      return null;
    }
    const schedules = await this.hydrateSchedules(tenantId, scheduleRows.rows);
    return schedules[0] ?? null;
  }

  async create(input: CreateScheduleInput): Promise<Schedule> {
    const r = await this.db.query<ScheduleRow>(
      `INSERT INTO schedules (tenant_id, name, description, timezone, weekly_rules_json, holiday_overrides_json)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
       RETURNING ${SCHEDULE_COLUMNS}`,
      [
        input.tenant_id,
        input.name,
        input.description ?? null,
        input.timezone,
        JSON.stringify(input.weekly_rules_json ?? []),
        JSON.stringify(input.holiday_overrides_json ?? []),
      ],
    );
    return this.hydrateSingle(input.tenant_id, r.rows[0]!);
  }

  async update(id: string, tenantId: string, input: UpdateScheduleInput): Promise<Schedule | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if ('description' in input) { fields.push(`description = $${idx++}`); values.push(input.description ?? null); }
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

    fields.push('updated_at = NOW()');
    values.push(id, tenantId);

    const r = await this.db.query<ScheduleRow>(
      `UPDATE schedules
       SET ${fields.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING ${SCHEDULE_COLUMNS}`,
      values,
    );
    if (!r.rows[0]) {
      return null;
    }
    return this.hydrateSingle(tenantId, r.rows[0]);
  }

  async deactivate(id: string, tenantId: string): Promise<Schedule | null> {
    const r = await this.db.query<ScheduleRow>(
      `UPDATE schedules
       SET status = 'inactive', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING ${SCHEDULE_COLUMNS}`,
      [id, tenantId],
    );
    if (!r.rows[0]) {
      return null;
    }
    return this.hydrateSingle(tenantId, r.rows[0]);
  }

  async createHolidayCalendar(input: CreateHolidayCalendarInput): Promise<HolidayCalendar> {
    const r = await this.db.query<HolidayCalendar>(
      `INSERT INTO holiday_calendars (tenant_id, schedule_id, name, description, entries_json)
       SELECT $1, s.id, $2, $3, $4::jsonb
       FROM schedules s
       WHERE s.id = $5 AND s.tenant_id = $1
       RETURNING ${HOLIDAY_CALENDAR_COLUMNS}`,
      [
        input.tenant_id,
        input.name,
        input.description ?? null,
        JSON.stringify(input.entries_json),
        input.schedule_id,
      ],
    );
    return r.rows[0] ?? null as never;
  }

  async updateHolidayCalendar(
    id: string,
    scheduleId: string,
    tenantId: string,
    input: UpdateHolidayCalendarInput,
  ): Promise<HolidayCalendar | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if ('description' in input) { fields.push(`description = $${idx++}`); values.push(input.description ?? null); }
    if (input.status !== undefined) { fields.push(`status = $${idx++}`); values.push(input.status); }
    if (input.entries_json !== undefined) {
      fields.push(`entries_json = $${idx++}::jsonb`);
      values.push(JSON.stringify(input.entries_json));
    }

    if (fields.length === 0) {
      return this.findHolidayCalendarById(id, scheduleId, tenantId);
    }

    fields.push('updated_at = NOW()');
    values.push(id, scheduleId, tenantId);

    const r = await this.db.query<HolidayCalendar>(
      `UPDATE holiday_calendars
       SET ${fields.join(', ')}
       WHERE id = $${idx} AND schedule_id = $${idx + 1} AND tenant_id = $${idx + 2}
       RETURNING ${HOLIDAY_CALENDAR_COLUMNS}`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async listHolidayCalendars(scheduleId: string, tenantId: string): Promise<HolidayCalendar[]> {
    const r = await this.db.query<HolidayCalendar>(
      `SELECT ${HOLIDAY_CALENDAR_COLUMNS}
       FROM holiday_calendars
       WHERE schedule_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC`,
      [scheduleId, tenantId],
    );
    return r.rows;
  }

  async findHolidayCalendarById(id: string, scheduleId: string, tenantId: string): Promise<HolidayCalendar | null> {
    const r = await this.db.query<HolidayCalendar>(
      `SELECT ${HOLIDAY_CALENDAR_COLUMNS}
       FROM holiday_calendars
       WHERE id = $1 AND schedule_id = $2 AND tenant_id = $3`,
      [id, scheduleId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async createScheduleOverride(input: CreateScheduleOverrideInput): Promise<ScheduleOverride> {
    const r = await this.db.query<ScheduleOverride>(
      `INSERT INTO schedule_overrides (
         tenant_id,
         schedule_id,
         name,
         reason,
         starts_at,
         ends_at,
         closed,
         open_time,
         close_time,
         created_by
       )
       SELECT
         $1,
         s.id,
         $2,
         $3,
         $4::timestamptz,
         $5::timestamptz,
         $6,
         $7,
         $8,
         $9
       FROM schedules s
       WHERE s.id = $10 AND s.tenant_id = $1
       RETURNING ${SCHEDULE_OVERRIDE_COLUMNS}`,
      [
        input.tenant_id,
        input.name,
        input.reason ?? null,
        input.starts_at,
        input.ends_at,
        input.closed,
        input.open_time ?? null,
        input.close_time ?? null,
        input.created_by ?? null,
        input.schedule_id,
      ],
    );
    return r.rows[0] ?? null as never;
  }

  async updateScheduleOverride(
    id: string,
    scheduleId: string,
    tenantId: string,
    input: UpdateScheduleOverrideInput,
  ): Promise<ScheduleOverride | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if ('reason' in input) { fields.push(`reason = $${idx++}`); values.push(input.reason ?? null); }
    if (input.starts_at !== undefined) { fields.push(`starts_at = $${idx++}::timestamptz`); values.push(input.starts_at); }
    if (input.ends_at !== undefined) { fields.push(`ends_at = $${idx++}::timestamptz`); values.push(input.ends_at); }
    if (input.closed !== undefined) { fields.push(`closed = $${idx++}`); values.push(input.closed); }
    if ('open_time' in input) { fields.push(`open_time = $${idx++}`); values.push(input.open_time ?? null); }
    if ('close_time' in input) { fields.push(`close_time = $${idx++}`); values.push(input.close_time ?? null); }

    if (fields.length === 0) {
      return this.findScheduleOverrideById(id, scheduleId, tenantId);
    }

    fields.push('updated_at = NOW()');
    values.push(id, scheduleId, tenantId);

    const r = await this.db.query<ScheduleOverride>(
      `UPDATE schedule_overrides
       SET ${fields.join(', ')}
       WHERE id = $${idx} AND schedule_id = $${idx + 1} AND tenant_id = $${idx + 2}
       RETURNING ${SCHEDULE_OVERRIDE_COLUMNS}`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async cancelScheduleOverride(
    id: string,
    scheduleId: string,
    tenantId: string,
    actorId?: string,
  ): Promise<ScheduleOverride | null> {
    const r = await this.db.query<ScheduleOverride>(
      `UPDATE schedule_overrides
       SET status = 'cancelled',
           cancelled_at = NOW(),
           cancelled_by = $4,
           updated_at = NOW()
       WHERE id = $1 AND schedule_id = $2 AND tenant_id = $3
       RETURNING ${SCHEDULE_OVERRIDE_COLUMNS}`,
      [id, scheduleId, tenantId, actorId ?? null],
    );
    return r.rows[0] ?? null;
  }

  async listScheduleOverrides(scheduleId: string, tenantId: string): Promise<ScheduleOverride[]> {
    const r = await this.db.query<ScheduleOverride>(
      `SELECT ${SCHEDULE_OVERRIDE_COLUMNS}
       FROM schedule_overrides
       WHERE schedule_id = $1 AND tenant_id = $2
       ORDER BY starts_at DESC, created_at DESC`,
      [scheduleId, tenantId],
    );
    return r.rows;
  }

  async findScheduleOverrideById(id: string, scheduleId: string, tenantId: string): Promise<ScheduleOverride | null> {
    const r = await this.db.query<ScheduleOverride>(
      `SELECT ${SCHEDULE_OVERRIDE_COLUMNS}
       FROM schedule_overrides
       WHERE id = $1 AND schedule_id = $2 AND tenant_id = $3`,
      [id, scheduleId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findActiveByIds(tenantId: string, ids: string[]): Promise<Map<string, Schedule>> {
    if (ids.length === 0) return new Map();
    const r = await this.db.query<ScheduleRow>(
      `SELECT ${SCHEDULE_COLUMNS}
       FROM schedules s
       WHERE s.tenant_id = $1 AND s.status = 'active' AND s.id = ANY($2)`,
      [tenantId, ids],
    );
    const schedules = await this.hydrateSchedules(tenantId, r.rows);
    return new Map(schedules.map((schedule) => [schedule.id, schedule]));
  }

  private async hydrateSingle(tenantId: string, row: ScheduleRow): Promise<Schedule> {
    const schedules = await this.hydrateSchedules(tenantId, [row]);
    return schedules[0]!;
  }

  private async hydrateSchedules(tenantId: string, rows: ScheduleRow[]): Promise<Schedule[]> {
    if (rows.length === 0) {
      return [];
    }

    const scheduleIds = rows.map((row) => row.id);
    const [holidayCalendars, overrides] = await Promise.all([
      this.db.query<HolidayCalendar>(
        `SELECT ${HOLIDAY_CALENDAR_COLUMNS}
         FROM holiday_calendars
         WHERE tenant_id = $1 AND schedule_id = ANY($2)
         ORDER BY created_at DESC`,
        [tenantId, scheduleIds],
      ),
      this.db.query<ScheduleOverride>(
        `SELECT ${SCHEDULE_OVERRIDE_COLUMNS}
         FROM schedule_overrides
         WHERE tenant_id = $1 AND schedule_id = ANY($2)
         ORDER BY starts_at DESC, created_at DESC`,
        [tenantId, scheduleIds],
      ),
    ]);

    const calendarsBySchedule = new Map<string, HolidayCalendar[]>();
    for (const calendar of holidayCalendars.rows) {
      const list = calendarsBySchedule.get(calendar.schedule_id) ?? [];
      list.push(calendar);
      calendarsBySchedule.set(calendar.schedule_id, list);
    }

    const overridesBySchedule = new Map<string, ScheduleOverride[]>();
    for (const override of overrides.rows) {
      const list = overridesBySchedule.get(override.schedule_id) ?? [];
      list.push(override);
      overridesBySchedule.set(override.schedule_id, list);
    }

    return rows.map((row) => ({
      ...row,
      holiday_calendars: calendarsBySchedule.get(row.id) ?? [],
      temporary_overrides: overridesBySchedule.get(row.id) ?? [],
    }));
  }
}
