import type { ScheduleRepository } from './schedule.repository.js';
import type {
  CreateHolidayCalendarInput,
  CreateScheduleInput,
  CreateScheduleOverrideInput,
  HolidayCalendar,
  HolidayOverride,
  Schedule,
  ScheduleOverride,
  UpdateHolidayCalendarInput,
  UpdateScheduleInput,
  UpdateScheduleOverrideInput,
} from './schedule.types.js';

export class ScheduleNotFoundError extends Error {
  constructor(id: string) { super(`Schedule not found: ${id}`); this.name = 'ScheduleNotFoundError'; }
}

export class HolidayCalendarNotFoundError extends Error {
  constructor(id: string) { super(`Holiday calendar not found: ${id}`); this.name = 'HolidayCalendarNotFoundError'; }
}

export class ScheduleOverrideNotFoundError extends Error {
  constructor(id: string) { super(`Schedule override not found: ${id}`); this.name = 'ScheduleOverrideNotFoundError'; }
}

const VALID_IANA_TIMEZONE = /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)*$/;
const TIME_HHMM = /^\d{2}:\d{2}$/;

function validateTimezone(tz: string): string | null {
  if (!VALID_IANA_TIMEZONE.test(tz)) return 'timezone must be a valid IANA timezone string';
  try {
    Intl.DateTimeFormat('en', { timeZone: tz });
    return null;
  } catch {
    return `Unknown timezone: ${tz}`;
  }
}

function validateRules(rules: unknown): string | null {
  if (!Array.isArray(rules)) return 'weekly_rules_json must be an array';
  for (const rule of rules) {
    if (typeof rule !== 'object' || rule === null) return 'Each weekly rule must be an object';
    const r = rule as Record<string, unknown>;
    if (typeof r.day_of_week !== 'number' || r.day_of_week < 0 || r.day_of_week > 6 || !Number.isInteger(r.day_of_week)) {
      return 'day_of_week must be an integer 0-6';
    }
    if (typeof r.open_time !== 'string' || !TIME_HHMM.test(r.open_time)) return 'open_time must be HH:MM';
    if (typeof r.close_time !== 'string' || !TIME_HHMM.test(r.close_time)) return 'close_time must be HH:MM';
    if (r.open_time >= r.close_time) return 'open_time must be before close_time';
  }
  return null;
}

function validateHolidayEntries(overrides: unknown, fieldName: string): string | null {
  if (!Array.isArray(overrides)) return `${fieldName} must be an array`;
  const seenDates = new Set<string>();
  for (const o of overrides) {
    if (typeof o !== 'object' || o === null) return 'Each holiday override must be an object';
    const ov = o as Record<string, unknown>;
    if (typeof ov.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ov.date)) return 'date must be YYYY-MM-DD';
    if (seenDates.has(ov.date)) return `duplicate holiday date is not allowed: ${ov.date}`;
    seenDates.add(ov.date);
    if (typeof ov.closed !== 'boolean') return 'closed must be a boolean';
    if (ov.label !== undefined && typeof ov.label !== 'string') return 'label must be a string when provided';
    if (!ov.closed) {
      if (typeof ov.open_time !== 'string' || !TIME_HHMM.test(ov.open_time)) return 'open_time must be HH:MM when not closed';
      if (typeof ov.close_time !== 'string' || !TIME_HHMM.test(ov.close_time)) return 'close_time must be HH:MM when not closed';
      if (ov.open_time >= ov.close_time) return 'open_time must be before close_time';
    }
  }
  return null;
}

function validateIsoDateTime(value: string, field: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return `${field} must be a valid ISO datetime`;
  }
  return null;
}

function validateOverrideWindow(input: {
  starts_at: string;
  ends_at: string;
  closed: boolean;
  open_time?: string | null;
  close_time?: string | null;
}): string | null {
  const startErr = validateIsoDateTime(input.starts_at, 'starts_at');
  if (startErr) return startErr;
  const endErr = validateIsoDateTime(input.ends_at, 'ends_at');
  if (endErr) return endErr;
  if (new Date(input.starts_at).getTime() >= new Date(input.ends_at).getTime()) {
    return 'starts_at must be before ends_at';
  }
  if (!input.closed) {
    if (!input.open_time || !TIME_HHMM.test(input.open_time)) return 'open_time must be HH:MM when closed is false';
    if (!input.close_time || !TIME_HHMM.test(input.close_time)) return 'close_time must be HH:MM when closed is false';
    if (input.open_time >= input.close_time) return 'open_time must be before close_time';
  }
  return null;
}

function collectHolidayDates(
  legacyEntries: HolidayOverride[] | undefined,
  calendars: Array<Pick<HolidayCalendar, 'id' | 'entries_json'>>,
  ignoreCalendarId?: string,
): Set<string> {
  const dates = new Set<string>();
  for (const entry of legacyEntries ?? []) {
    dates.add(entry.date);
  }
  for (const calendar of calendars) {
    if (ignoreCalendarId && calendar.id === ignoreCalendarId) {
      continue;
    }
    for (const entry of calendar.entries_json) {
      dates.add(entry.date);
    }
  }
  return dates;
}

export class ScheduleValidationError extends Error {
  constructor(msg: string) { super(msg); this.name = 'ScheduleValidationError'; }
}

export class ScheduleService {
  constructor(private readonly repo: ScheduleRepository) {}

  listByTenant(tenantId: string): Promise<Schedule[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<Schedule> {
    const schedule = await this.repo.findById(id, tenantId);
    if (!schedule) throw new ScheduleNotFoundError(id);
    return schedule;
  }

  async create(input: CreateScheduleInput): Promise<Schedule> {
    const tzErr = validateTimezone(input.timezone);
    if (tzErr) throw new ScheduleValidationError(tzErr);
    if (input.weekly_rules_json !== undefined) {
      const err = validateRules(input.weekly_rules_json);
      if (err) throw new ScheduleValidationError(err);
    }
    if (input.holiday_overrides_json !== undefined) {
      const err = validateHolidayEntries(input.holiday_overrides_json, 'holiday_overrides_json');
      if (err) throw new ScheduleValidationError(err);
    }
    return this.repo.create(input);
  }

  async update(id: string, tenantId: string, input: UpdateScheduleInput): Promise<Schedule> {
    if (input.timezone !== undefined) {
      const tzErr = validateTimezone(input.timezone);
      if (tzErr) throw new ScheduleValidationError(tzErr);
    }
    if (input.weekly_rules_json !== undefined) {
      const err = validateRules(input.weekly_rules_json);
      if (err) throw new ScheduleValidationError(err);
    }
    if (input.holiday_overrides_json !== undefined) {
      const err = validateHolidayEntries(input.holiday_overrides_json, 'holiday_overrides_json');
      if (err) throw new ScheduleValidationError(err);
    }
    const schedule = await this.repo.update(id, tenantId, input);
    if (!schedule) throw new ScheduleNotFoundError(id);
    return schedule;
  }

  async deactivate(id: string, tenantId: string): Promise<Schedule> {
    const schedule = await this.repo.deactivate(id, tenantId);
    if (!schedule) throw new ScheduleNotFoundError(id);
    return schedule;
  }

  async listHolidayCalendars(scheduleId: string, tenantId: string): Promise<HolidayCalendar[]> {
    await this.getById(scheduleId, tenantId);
    return this.repo.listHolidayCalendars(scheduleId, tenantId);
  }

  async createHolidayCalendar(input: CreateHolidayCalendarInput): Promise<HolidayCalendar> {
    const schedule = await this.getById(input.schedule_id, input.tenant_id);
    const err = validateHolidayEntries(input.entries_json, 'entries_json');
    if (err) throw new ScheduleValidationError(err);
    const existingDates = collectHolidayDates(schedule.holiday_overrides_json, schedule.holiday_calendars);
    for (const entry of input.entries_json) {
      if (existingDates.has(entry.date)) {
        throw new ScheduleValidationError(`holiday date already exists on this schedule group: ${entry.date}`);
      }
    }
    const calendar = await this.repo.createHolidayCalendar(input);
    if (!calendar) throw new ScheduleNotFoundError(input.schedule_id);
    return calendar;
  }

  async updateHolidayCalendar(
    id: string,
    scheduleId: string,
    tenantId: string,
    input: UpdateHolidayCalendarInput,
  ): Promise<HolidayCalendar> {
    const schedule = await this.getById(scheduleId, tenantId);
    if (input.entries_json !== undefined) {
      const err = validateHolidayEntries(input.entries_json, 'entries_json');
      if (err) throw new ScheduleValidationError(err);
      const existingDates = collectHolidayDates(
        schedule.holiday_overrides_json,
        schedule.holiday_calendars,
        id,
      );
      for (const entry of input.entries_json) {
        if (existingDates.has(entry.date)) {
          throw new ScheduleValidationError(`holiday date already exists on this schedule group: ${entry.date}`);
        }
      }
    }
    const calendar = await this.repo.updateHolidayCalendar(id, scheduleId, tenantId, input);
    if (!calendar) throw new HolidayCalendarNotFoundError(id);
    return calendar;
  }

  async createScheduleOverride(input: CreateScheduleOverrideInput): Promise<ScheduleOverride> {
    await this.getById(input.schedule_id, input.tenant_id);
    const err = validateOverrideWindow(input);
    if (err) throw new ScheduleValidationError(err);
    const override = await this.repo.createScheduleOverride(input);
    if (!override) throw new ScheduleNotFoundError(input.schedule_id);
    return override;
  }

  async updateScheduleOverride(
    id: string,
    scheduleId: string,
    tenantId: string,
    input: UpdateScheduleOverrideInput,
  ): Promise<ScheduleOverride> {
    const existing = await this.repo.findScheduleOverrideById(id, scheduleId, tenantId);
    if (!existing) throw new ScheduleOverrideNotFoundError(id);
    const merged = {
      starts_at: input.starts_at ?? existing.starts_at.toISOString(),
      ends_at: input.ends_at ?? existing.ends_at.toISOString(),
      closed: input.closed ?? existing.closed,
      open_time: 'open_time' in input ? input.open_time ?? null : existing.open_time ?? null,
      close_time: 'close_time' in input ? input.close_time ?? null : existing.close_time ?? null,
    };
    const err = validateOverrideWindow(merged);
    if (err) throw new ScheduleValidationError(err);
    const override = await this.repo.updateScheduleOverride(id, scheduleId, tenantId, input);
    if (!override) throw new ScheduleOverrideNotFoundError(id);
    return override;
  }

  async listScheduleOverrides(scheduleId: string, tenantId: string): Promise<ScheduleOverride[]> {
    await this.getById(scheduleId, tenantId);
    return this.repo.listScheduleOverrides(scheduleId, tenantId);
  }

  async cancelScheduleOverride(
    id: string,
    scheduleId: string,
    tenantId: string,
    actorId?: string,
  ): Promise<ScheduleOverride> {
    await this.getById(scheduleId, tenantId);
    const override = await this.repo.cancelScheduleOverride(id, scheduleId, tenantId, actorId);
    if (!override) throw new ScheduleOverrideNotFoundError(id);
    return override;
  }
}
