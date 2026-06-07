import { randomUUID } from 'node:crypto';
import type { ScheduleRepository } from './schedule.repository.js';
import type {
  CreateScheduleInput,
  CreateScheduleOverrideInput,
  HolidayCalendarEntry,
  Schedule,
  ScheduleOverride,
  UpdateScheduleInput,
  WeeklyRule,
} from './schedule.types.js';

export class ScheduleNotFoundError extends Error {
  constructor(id: string) { super(`Schedule not found: ${id}`); this.name = 'ScheduleNotFoundError'; }
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
  const seenDays = new Set<number>();
  for (const rule of rules) {
    if (typeof rule !== 'object' || rule === null) return 'Each weekly rule must be an object';
    const item = rule as Record<string, unknown>;
    if (typeof item.day_of_week !== 'number' || item.day_of_week < 0 || item.day_of_week > 6 || !Number.isInteger(item.day_of_week)) {
      return 'day_of_week must be an integer 0-6';
    }
    if (typeof item.open_time !== 'string' || !TIME_HHMM.test(item.open_time)) return 'open_time must be HH:MM';
    if (typeof item.close_time !== 'string' || !TIME_HHMM.test(item.close_time)) return 'close_time must be HH:MM';
    if (item.open_time >= item.close_time) return 'open_time must be before close_time';
    if (seenDays.has(item.day_of_week)) return 'weekly_rules_json may only contain one rule per day_of_week';
    seenDays.add(item.day_of_week);
  }
  return null;
}

function validateHolidayCalendar(entries: unknown): string | null {
  if (!Array.isArray(entries)) return 'holiday_calendar_json must be an array';
  const seenDates = new Set<string>();
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) return 'Each holiday calendar entry must be an object';
    const item = entry as Record<string, unknown>;
    if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return 'holiday calendar date must be YYYY-MM-DD';
    if (typeof item.name !== 'string' || item.name.trim().length === 0) return 'holiday calendar name is required';
    if (seenDates.has(item.date)) return 'holiday_calendar_json may only contain one entry per date';
    seenDates.add(item.date);
    if (typeof item.closed !== 'boolean') return 'holiday calendar closed must be a boolean';
    if (!item.closed) {
      if (typeof item.open_time !== 'string' || !TIME_HHMM.test(item.open_time)) return 'holiday calendar open_time must be HH:MM when not closed';
      if (typeof item.close_time !== 'string' || !TIME_HHMM.test(item.close_time)) return 'holiday calendar close_time must be HH:MM when not closed';
      if (item.open_time >= item.close_time) return 'holiday calendar open_time must be before close_time';
    }
  }
  return null;
}

function validateOverrideWindow(input: Record<string, unknown>, allowAuditFields: boolean): string | null {
  if (typeof input.name !== 'string' || input.name.trim().length === 0) return 'override name is required';
  if (typeof input.starts_at !== 'string' || Number.isNaN(Date.parse(input.starts_at))) return 'override starts_at must be an ISO datetime';
  if (typeof input.ends_at !== 'string' || Number.isNaN(Date.parse(input.ends_at))) return 'override ends_at must be an ISO datetime';
  if (Date.parse(input.starts_at) >= Date.parse(input.ends_at)) return 'override ends_at must be after starts_at';
  if (input.mode !== 'closed' && input.mode !== 'custom_hours') return 'override mode must be closed or custom_hours';
  if (input.mode === 'custom_hours') {
    if (typeof input.open_time !== 'string' || !TIME_HHMM.test(input.open_time)) return 'override open_time must be HH:MM when mode is custom_hours';
    if (typeof input.close_time !== 'string' || !TIME_HHMM.test(input.close_time)) return 'override close_time must be HH:MM when mode is custom_hours';
    if (input.open_time >= input.close_time) return 'override open_time must be before close_time';
  }
  if (!allowAuditFields) return null;
  if (typeof input.id !== 'string' || input.id.length === 0) return 'override id is required';
  if (input.status !== 'active' && input.status !== 'revoked') return 'override status must be active or revoked';
  if (typeof input.created_at !== 'string' || Number.isNaN(Date.parse(input.created_at))) return 'override created_at must be an ISO datetime';
  if (input.created_by_user_id !== null && input.created_by_user_id !== undefined && typeof input.created_by_user_id !== 'string') {
    return 'override created_by_user_id must be a string or null';
  }
  if (input.revoked_by_user_id !== null && input.revoked_by_user_id !== undefined && typeof input.revoked_by_user_id !== 'string') {
    return 'override revoked_by_user_id must be a string or null';
  }
  if (input.revoked_at !== null && input.revoked_at !== undefined && (typeof input.revoked_at !== 'string' || Number.isNaN(Date.parse(input.revoked_at)))) {
    return 'override revoked_at must be an ISO datetime or null';
  }
  return null;
}

function validatePersistedOverrides(overrides: unknown): string | null {
  if (!Array.isArray(overrides)) return 'override_windows_json must be an array';
  for (const override of overrides) {
    if (typeof override !== 'object' || override === null) return 'Each override window must be an object';
    const err = validateOverrideWindow(override as Record<string, unknown>, true);
    if (err) return err;
  }
  return null;
}

function normalizeWeeklyRules(rules: WeeklyRule[] | undefined): WeeklyRule[] | undefined {
  return rules?.slice().sort((a, b) => a.day_of_week - b.day_of_week);
}

function normalizeHolidayCalendar(entries: HolidayCalendarEntry[] | undefined): HolidayCalendarEntry[] | undefined {
  return entries?.map((entry) => ({
    ...entry,
    name: entry.name.trim(),
  }));
}

function normalizeOverrides(overrides: ScheduleOverride[]): ScheduleOverride[] {
  return overrides
    .slice()
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at) || a.created_at.localeCompare(b.created_at));
}

function validateScheduleMutation(input: {
  timezone?: string;
  weekly_rules_json?: WeeklyRule[];
  holiday_calendar_json?: HolidayCalendarEntry[];
  override_windows_json?: ScheduleOverride[];
}): string | null {
  if (input.timezone !== undefined) {
    const tzErr = validateTimezone(input.timezone);
    if (tzErr) return tzErr;
  }
  if (input.weekly_rules_json !== undefined) {
    const err = validateRules(input.weekly_rules_json);
    if (err) return err;
  }
  if (input.holiday_calendar_json !== undefined) {
    const err = validateHolidayCalendar(input.holiday_calendar_json);
    if (err) return err;
  }
  if (input.override_windows_json !== undefined) {
    const err = validatePersistedOverrides(input.override_windows_json);
    if (err) return err;
  }
  return null;
}

function validateCreateOverrideInput(input: CreateScheduleOverrideInput): string | null {
  return validateOverrideWindow(input as unknown as Record<string, unknown>, false);
}

function buildOverride(input: CreateScheduleOverrideInput): ScheduleOverride {
  const createdAt = new Date().toISOString();
  return {
    id: randomUUID(),
    name: input.name.trim(),
    reason: input.reason?.trim() || null,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    mode: input.mode,
    open_time: input.mode === 'custom_hours' ? input.open_time : undefined,
    close_time: input.mode === 'custom_hours' ? input.close_time : undefined,
    status: 'active',
    created_by_user_id: input.actor_user_id,
    created_at: createdAt,
    revoked_by_user_id: null,
    revoked_at: null,
  };
}

function hasOverlap(existing: ScheduleOverride[], candidate: ScheduleOverride): string | null {
  const candidateStart = Date.parse(candidate.starts_at);
  const candidateEnd = Date.parse(candidate.ends_at);
  for (const override of existing) {
    if (override.status !== 'active') continue;
    const startsAt = Date.parse(override.starts_at);
    const endsAt = Date.parse(override.ends_at);
    if (candidateStart < endsAt && candidateEnd > startsAt) {
      return `override overlaps existing active override ${override.name}`;
    }
  }
  return null;
}

function revokeOverride(overrides: ScheduleOverride[], overrideId: string, actorUserId: string | null): ScheduleOverride[] | null {
  let found = false;
  const revokedAt = new Date().toISOString();
  const next: ScheduleOverride[] = overrides.map((override) => {
    if (override.id !== overrideId) return override;
    found = true;
    if (override.status === 'revoked') return override;
    return {
      ...override,
      status: 'revoked' as const,
      revoked_by_user_id: actorUserId,
      revoked_at: revokedAt,
    };
  });
  return found ? next : null;
}

function mapCreateInput(input: CreateScheduleInput): CreateScheduleInput {
  return {
    ...input,
    description: input.description?.trim() || null,
    holiday_calendar_name: input.holiday_calendar_name?.trim() || null,
    weekly_rules_json: normalizeWeeklyRules(input.weekly_rules_json),
    holiday_calendar_json: normalizeHolidayCalendar(input.holiday_calendar_json),
  };
}

function mapUpdateInput(input: UpdateScheduleInput): UpdateScheduleInput {
  return {
    ...input,
    description: input.description === undefined ? undefined : (input.description?.trim() || null),
    holiday_calendar_name: input.holiday_calendar_name === undefined ? undefined : (input.holiday_calendar_name?.trim() || null),
    weekly_rules_json: normalizeWeeklyRules(input.weekly_rules_json),
    holiday_calendar_json: normalizeHolidayCalendar(input.holiday_calendar_json),
  };
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
    const normalized = mapCreateInput(input);
    const err = validateScheduleMutation(normalized);
    if (err) throw new ScheduleValidationError(err);
    return this.repo.create(normalized);
  }

  async update(id: string, tenantId: string, input: UpdateScheduleInput): Promise<Schedule> {
    const normalized = mapUpdateInput(input);
    const err = validateScheduleMutation(normalized);
    if (err) throw new ScheduleValidationError(err);
    const schedule = await this.repo.update(id, tenantId, normalized);
    if (!schedule) throw new ScheduleNotFoundError(id);
    return schedule;
  }

  async deactivate(id: string, tenantId: string): Promise<Schedule> {
    const schedule = await this.repo.deactivate(id, tenantId);
    if (!schedule) throw new ScheduleNotFoundError(id);
    return schedule;
  }

  async addOverride(id: string, tenantId: string, input: CreateScheduleOverrideInput): Promise<Schedule> {
    const err = validateCreateOverrideInput(input);
    if (err) throw new ScheduleValidationError(err);

    const schedule = await this.getById(id, tenantId);
    if (schedule.status !== 'active') throw new ScheduleValidationError('override workflows require an active schedule');

    const override = buildOverride(input);
    const overlapErr = hasOverlap(schedule.override_windows_json, override);
    if (overlapErr) throw new ScheduleValidationError(overlapErr);

    const updated = await this.repo.replaceOverrides(id, tenantId, normalizeOverrides([...schedule.override_windows_json, override]));
    if (!updated) throw new ScheduleNotFoundError(id);
    return updated;
  }

  async revokeOverride(id: string, tenantId: string, overrideId: string, actorUserId: string | null): Promise<Schedule> {
    const schedule = await this.getById(id, tenantId);
    const next = revokeOverride(schedule.override_windows_json, overrideId, actorUserId);
    if (!next) throw new ScheduleOverrideNotFoundError(overrideId);

    const updated = await this.repo.replaceOverrides(id, tenantId, normalizeOverrides(next));
    if (!updated) throw new ScheduleNotFoundError(id);
    return updated;
  }
}
