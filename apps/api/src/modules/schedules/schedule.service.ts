import type { ScheduleRepository } from './schedule.repository.js';
import type {
  CancelScheduleOverrideInput,
  CreateHolidayCalendarInput,
  CreateScheduleGroupInput,
  CreateScheduleInput,
  CreateScheduleOverrideInput,
  HolidayCalendar,
  HolidayCalendarEntry,
  Schedule,
  ScheduleGroup,
  ScheduleOverride,
  ScheduleOverrideLifecycleState,
  UpdateHolidayCalendarInput,
  UpdateScheduleGroupInput,
  UpdateScheduleInput,
  WeeklyRule,
} from './schedule.types.js';

export class ScheduleNotFoundError extends Error {
  constructor(id: string) {
    super(`Schedule not found: ${id}`);
    this.name = 'ScheduleNotFoundError';
  }
}

export class ScheduleGroupNotFoundError extends Error {
  constructor(id: string) {
    super(`Schedule group not found: ${id}`);
    this.name = 'ScheduleGroupNotFoundError';
  }
}

export class HolidayCalendarNotFoundError extends Error {
  constructor(id: string) {
    super(`Holiday calendar not found: ${id}`);
    this.name = 'HolidayCalendarNotFoundError';
  }
}

export class ScheduleOverrideNotFoundError extends Error {
  constructor(id: string) {
    super(`Schedule override not found: ${id}`);
    this.name = 'ScheduleOverrideNotFoundError';
  }
}

export class ScheduleConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduleConflictError';
  }
}

const VALID_IANA_TIMEZONE = /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)*$/;
const TIME_HHMM = /^\d{2}:\d{2}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

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

function validateEntries(entries: unknown, fieldName: 'holiday_overrides_json' | 'entries_json'): string | null {
  if (!Array.isArray(entries)) return `${fieldName} must be an array`;
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) return `Each ${fieldName === 'entries_json' ? 'holiday calendar entry' : 'holiday override'} must be an object`;
    const value = entry as Record<string, unknown>;
    if (typeof value.date !== 'string' || !DATE_ONLY.test(value.date)) return 'date must be YYYY-MM-DD';
    if (typeof value.closed !== 'boolean') return 'closed must be a boolean';
    if (value.name !== undefined && typeof value.name !== 'string') return 'name must be a string';
    if (!value.closed) {
      if (typeof value.open_time !== 'string' || !TIME_HHMM.test(value.open_time)) return 'open_time must be HH:MM when not closed';
      if (typeof value.close_time !== 'string' || !TIME_HHMM.test(value.close_time)) return 'close_time must be HH:MM when not closed';
      if (value.open_time >= value.close_time) return 'open_time must be before close_time';
    }
  }
  return null;
}

function computeOverrideLifecycleState(
  record: Pick<ScheduleOverride, 'starts_at' | 'ends_at' | 'cancelled_at'>,
  now: Date = new Date(),
): ScheduleOverrideLifecycleState {
  if (record.cancelled_at) return 'cancelled';
  if (record.ends_at <= now) return 'expired';
  if (record.starts_at <= now && record.ends_at > now) return 'active';
  return 'scheduled';
}

function validateOverrideWindow(input: Pick<CreateScheduleOverrideInput, 'mode' | 'open_time' | 'close_time' | 'starts_at' | 'ends_at'>): string | null {
  const startsAt = new Date(input.starts_at);
  const endsAt = new Date(input.ends_at);
  if (Number.isNaN(startsAt.getTime())) return 'starts_at must be a valid datetime';
  if (Number.isNaN(endsAt.getTime())) return 'ends_at must be a valid datetime';
  if (endsAt <= startsAt) return 'ends_at must be after starts_at';
  if (input.mode === 'closed') {
    if (input.open_time != null || input.close_time != null) return 'closed overrides cannot include open_time or close_time';
    return null;
  }
  if (typeof input.open_time !== 'string' || !TIME_HHMM.test(input.open_time)) return 'open_time must be HH:MM for custom_hours overrides';
  if (typeof input.close_time !== 'string' || !TIME_HHMM.test(input.close_time)) return 'close_time must be HH:MM for custom_hours overrides';
  if (input.open_time >= input.close_time) return 'open_time must be before close_time';
  return null;
}

async function resolveScheduleRules(
  repo: ScheduleRepository,
  tenantId: string,
  input: {
    schedule_group_id?: string | null;
    holiday_calendar_id?: string | null;
    weekly_rules_json?: WeeklyRule[];
    holiday_overrides_json?: HolidayCalendarEntry[];
  },
): Promise<{
  schedule_group_id?: string | null;
  holiday_calendar_id?: string | null;
  weekly_rules_json?: WeeklyRule[];
  holiday_overrides_json?: HolidayCalendarEntry[];
}> {
  if (input.schedule_group_id !== undefined && input.weekly_rules_json !== undefined) {
    throw new ScheduleValidationError('weekly_rules_json cannot be supplied when schedule_group_id is set');
  }
  if (input.holiday_calendar_id !== undefined && input.holiday_overrides_json !== undefined) {
    throw new ScheduleValidationError('holiday_overrides_json cannot be supplied when holiday_calendar_id is set');
  }

  const next = { ...input };
  if (input.schedule_group_id) {
    const group = await repo.findScheduleGroupById(input.schedule_group_id, tenantId);
    if (!group) throw new ScheduleGroupNotFoundError(input.schedule_group_id);
    next.weekly_rules_json = group.weekly_rules_json;
  }
  if (input.holiday_calendar_id) {
    const calendar = await repo.findHolidayCalendarById(input.holiday_calendar_id, tenantId);
    if (!calendar) throw new HolidayCalendarNotFoundError(input.holiday_calendar_id);
    next.holiday_overrides_json = calendar.entries_json;
  }
  return next;
}

export class ScheduleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduleValidationError';
  }
}

export class ScheduleService {
  constructor(private readonly repo: ScheduleRepository) {}

  listByTenant(tenantId: string): Promise<Schedule[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  listScheduleGroups(tenantId: string): Promise<ScheduleGroup[]> {
    return this.repo.findAllScheduleGroupsByTenant(tenantId);
  }

  listHolidayCalendars(tenantId: string): Promise<HolidayCalendar[]> {
    return this.repo.findAllHolidayCalendarsByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<Schedule> {
    const schedule = await this.repo.findById(id, tenantId);
    if (!schedule) throw new ScheduleNotFoundError(id);
    return schedule;
  }

  async createGroup(input: CreateScheduleGroupInput): Promise<ScheduleGroup> {
    const err = validateRules(input.weekly_rules_json);
    if (err) throw new ScheduleValidationError(err);
    return this.repo.createScheduleGroup(input);
  }

  async updateGroup(id: string, tenantId: string, input: UpdateScheduleGroupInput): Promise<ScheduleGroup> {
    if (input.weekly_rules_json !== undefined) {
      const err = validateRules(input.weekly_rules_json);
      if (err) throw new ScheduleValidationError(err);
    }
    const group = await this.repo.updateScheduleGroup(id, tenantId, input);
    if (!group) throw new ScheduleGroupNotFoundError(id);
    if (input.weekly_rules_json !== undefined) {
      await this.repo.syncSchedulesForGroup(id, tenantId, input.weekly_rules_json);
    }
    return group;
  }

  async createHolidayCalendar(input: CreateHolidayCalendarInput): Promise<HolidayCalendar> {
    const err = validateEntries(input.entries_json, 'entries_json');
    if (err) throw new ScheduleValidationError(err);
    return this.repo.createHolidayCalendar(input);
  }

  async updateHolidayCalendar(id: string, tenantId: string, input: UpdateHolidayCalendarInput): Promise<HolidayCalendar> {
    if (input.entries_json !== undefined) {
      const err = validateEntries(input.entries_json, 'entries_json');
      if (err) throw new ScheduleValidationError(err);
    }
    const calendar = await this.repo.updateHolidayCalendar(id, tenantId, input);
    if (!calendar) throw new HolidayCalendarNotFoundError(id);
    if (input.entries_json !== undefined) {
      await this.repo.syncSchedulesForHolidayCalendar(id, tenantId, input.entries_json);
    }
    return calendar;
  }

  async create(input: CreateScheduleInput): Promise<Schedule> {
    const tzErr = validateTimezone(input.timezone);
    if (tzErr) throw new ScheduleValidationError(tzErr);
    if (input.weekly_rules_json !== undefined) {
      const err = validateRules(input.weekly_rules_json);
      if (err) throw new ScheduleValidationError(err);
    }
    if (input.holiday_overrides_json !== undefined) {
      const err = validateEntries(input.holiday_overrides_json, 'holiday_overrides_json');
      if (err) throw new ScheduleValidationError(err);
    }
    const resolved = await resolveScheduleRules(this.repo, input.tenant_id, input);
    return this.repo.create({ ...input, ...resolved });
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
      const err = validateEntries(input.holiday_overrides_json, 'holiday_overrides_json');
      if (err) throw new ScheduleValidationError(err);
    }
    const resolved = await resolveScheduleRules(this.repo, tenantId, input);
    const schedule = await this.repo.update(id, tenantId, { ...input, ...resolved });
    if (!schedule) throw new ScheduleNotFoundError(id);
    return schedule;
  }

  async deactivate(id: string, tenantId: string): Promise<Schedule> {
    const schedule = await this.repo.deactivate(id, tenantId);
    if (!schedule) throw new ScheduleNotFoundError(id);
    return schedule;
  }

  async listOverrides(scheduleId: string, tenantId: string): Promise<ScheduleOverride[]> {
    await this.getById(scheduleId, tenantId);
    const overrides = await this.repo.findOverridesBySchedule(scheduleId, tenantId);
    return overrides.map((record) => ({
      ...record,
      lifecycle_state: computeOverrideLifecycleState(record),
    }));
  }

  async createOverride(input: CreateScheduleOverrideInput): Promise<ScheduleOverride> {
    await this.getById(input.schedule_id, input.tenant_id);
    const err = validateOverrideWindow(input);
    if (err) throw new ScheduleValidationError(err);

    const startsAt = new Date(input.starts_at);
    const endsAt = new Date(input.ends_at);
    const overlaps = await this.repo.findOverlappingOverrides(input.schedule_id, input.tenant_id, startsAt, endsAt);
    const nonExpired = overlaps.filter((record) => computeOverrideLifecycleState(record, startsAt) !== 'expired');
    if (nonExpired.length > 0) {
      throw new ScheduleConflictError('schedule override overlaps an existing scheduled or active override');
    }

    const created = await this.repo.createOverride(input);
    return {
      ...created,
      lifecycle_state: computeOverrideLifecycleState(created),
    };
  }

  async cancelOverride(scheduleId: string, overrideId: string, tenantId: string, input: CancelScheduleOverrideInput): Promise<ScheduleOverride> {
    await this.getById(scheduleId, tenantId);
    const existing = await this.repo.findOverrideById(overrideId, scheduleId, tenantId);
    if (!existing) throw new ScheduleOverrideNotFoundError(overrideId);
    if (computeOverrideLifecycleState(existing) === 'cancelled') {
      throw new ScheduleConflictError('schedule override is already cancelled');
    }
    const cancelled = await this.repo.cancelOverride(overrideId, scheduleId, tenantId, input);
    if (!cancelled) throw new ScheduleOverrideNotFoundError(overrideId);
    return {
      ...cancelled,
      lifecycle_state: computeOverrideLifecycleState(cancelled),
    };
  }
}
