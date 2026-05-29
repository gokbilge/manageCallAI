import type { ScheduleRepository } from './schedule.repository.js';
import type { CreateScheduleInput, Schedule, UpdateScheduleInput } from './schedule.types.js';

export class ScheduleNotFoundError extends Error {
  constructor(id: string) { super(`Schedule not found: ${id}`); this.name = 'ScheduleNotFoundError'; }
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
      return 'day_of_week must be an integer 0–6';
    }
    if (typeof r.open_time !== 'string' || !TIME_HHMM.test(r.open_time)) return 'open_time must be HH:MM';
    if (typeof r.close_time !== 'string' || !TIME_HHMM.test(r.close_time)) return 'close_time must be HH:MM';
    if (r.open_time >= r.close_time) return 'open_time must be before close_time';
  }
  return null;
}

function validateOverrides(overrides: unknown): string | null {
  if (!Array.isArray(overrides)) return 'holiday_overrides_json must be an array';
  for (const o of overrides) {
    if (typeof o !== 'object' || o === null) return 'Each holiday override must be an object';
    const ov = o as Record<string, unknown>;
    if (typeof ov.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ov.date)) return 'date must be YYYY-MM-DD';
    if (typeof ov.closed !== 'boolean') return 'closed must be a boolean';
    if (!ov.closed) {
      if (typeof ov.open_time !== 'string' || !TIME_HHMM.test(ov.open_time)) return 'open_time must be HH:MM when not closed';
      if (typeof ov.close_time !== 'string' || !TIME_HHMM.test(ov.close_time)) return 'close_time must be HH:MM when not closed';
    }
  }
  return null;
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
    const s = await this.repo.findById(id, tenantId);
    if (!s) throw new ScheduleNotFoundError(id);
    return s;
  }

  async create(input: CreateScheduleInput): Promise<Schedule> {
    const tzErr = validateTimezone(input.timezone);
    if (tzErr) throw new ScheduleValidationError(tzErr);
    if (input.weekly_rules_json !== undefined) {
      const err = validateRules(input.weekly_rules_json);
      if (err) throw new ScheduleValidationError(err);
    }
    if (input.holiday_overrides_json !== undefined) {
      const err = validateOverrides(input.holiday_overrides_json);
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
      const err = validateOverrides(input.holiday_overrides_json);
      if (err) throw new ScheduleValidationError(err);
    }
    const s = await this.repo.update(id, tenantId, input);
    if (!s) throw new ScheduleNotFoundError(id);
    return s;
  }

  async deactivate(id: string, tenantId: string): Promise<Schedule> {
    const s = await this.repo.deactivate(id, tenantId);
    if (!s) throw new ScheduleNotFoundError(id);
    return s;
  }
}
