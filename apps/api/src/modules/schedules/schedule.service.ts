import type { ScheduleRepository } from './schedule.repository.js';
import type { CreateScheduleInput, Schedule, UpdateScheduleInput } from './schedule.types.js';
import type { EnterpriseLifecycleService } from '../shared/enterprise-lifecycle.service.js';
import type {
  EnterpriseVersion,
  EnterpriseValidationResult,
  EnterpriseSimulationResult,
  EnterpriseDryRunResult,
  EnterprisePublishAttemptResult,
} from '../shared/enterprise-lifecycle.types.js';
import type { Role } from '../auth/capabilities.js';

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
  constructor(
    private readonly repo: ScheduleRepository,
    private readonly lifecycleSvc?: EnterpriseLifecycleService,
  ) {}

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

  // ── Publish lifecycle (#319, #320, #321) ──────────────────────────────────

  private get lifecycle(): EnterpriseLifecycleService {
    if (!this.lifecycleSvc) throw new Error('EnterpriseLifecycleService not provided');
    return this.lifecycleSvc;
  }

  createVersion(scheduleId: string, tenantId: string, definition: Record<string, unknown>, createdBy?: string, metadata?: Record<string, unknown>): Promise<EnterpriseVersion> {
    return this.lifecycle.createVersion('schedule', scheduleId, tenantId, definition, createdBy, metadata);
  }

  listVersions(scheduleId: string, tenantId: string): Promise<EnterpriseVersion[]> {
    return this.lifecycle.listVersions('schedule', scheduleId, tenantId);
  }

  async validate(scheduleId: string, versionId: string, tenantId: string): Promise<EnterpriseValidationResult> {
    const schedule = await this.repo.findById(scheduleId, tenantId);
    if (!schedule) throw new ScheduleNotFoundError(scheduleId);
    return this.lifecycle.validate('schedule', scheduleId, versionId, tenantId, async () => {
      const errors: { field: string; message: string }[] = [];
      const tzErr = validateTimezone(schedule.timezone);
      if (tzErr) errors.push({ field: 'timezone', message: tzErr });
      const rulesErr = validateRules(schedule.weekly_rules_json);
      if (rulesErr) errors.push({ field: 'weekly_rules_json', message: rulesErr });
      const overridesErr = validateOverrides(schedule.holiday_overrides_json ?? []);
      if (overridesErr) errors.push({ field: 'holiday_overrides_json', message: overridesErr });
      return { status: errors.length === 0 ? 'passed' : 'failed', errors, warnings: [] };
    });
  }

  async simulate(scheduleId: string, versionId: string, tenantId: string, checkAt: string): Promise<EnterpriseSimulationResult> {
    const schedule = await this.repo.findById(scheduleId, tenantId);
    if (!schedule) throw new ScheduleNotFoundError(scheduleId);
    const outcome = {
      status: 'passed',
      schedule_id: scheduleId,
      check_at: checkAt,
      timezone: schedule.timezone,
      notes: 'Schedule structure is valid for time-based routing.',
    };
    return this.lifecycle.simulate('schedule', scheduleId, versionId, tenantId, { check_at: checkAt }, async () => outcome);
  }

  dryRunPublish(scheduleId: string, versionId: string, tenantId: string, actorType: 'user' | 'workflow' | 'ai_agent' | 'system' = 'user', actorRole?: Role): Promise<EnterpriseDryRunResult> {
    return this.lifecycle.dryRunPublish('schedule', scheduleId, versionId, tenantId, actorType, actorRole);
  }

  publish(scheduleId: string, versionId: string, tenantId: string, triggeredById: string, actorRole?: Role, actorType: 'user' | 'workflow' | 'ai_agent' | 'system' = 'user'): Promise<EnterprisePublishAttemptResult> {
    return this.lifecycle.publish('schedule', scheduleId, versionId, tenantId, triggeredById, actorRole, actorType);
  }

  rollback(scheduleId: string, tenantId: string, triggeredById: string, actorRole?: Role, actorType: 'user' | 'workflow' | 'ai_agent' | 'system' = 'user'): Promise<EnterprisePublishAttemptResult> {
    return this.lifecycle.rollback('schedule', scheduleId, tenantId, triggeredById, actorRole, actorType);
  }
}
