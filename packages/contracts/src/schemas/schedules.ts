import { z } from '../registry.js';

// ── Resource schemas ──────────────────────────────────────────────────────────
export const WeeklyRuleSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  open_time: z.string(),
  close_time: z.string(),
}).openapi('WeeklyRule');
export type WeeklyRule = z.infer<typeof WeeklyRuleSchema>;

export const HolidayOverrideSchema = z.object({
  date: z.string(),
  closed: z.boolean(),
  open_time: z.string().optional(),
  close_time: z.string().optional(),
}).openapi('HolidayOverride');
export type HolidayOverride = z.infer<typeof HolidayOverrideSchema>;

export const ScheduleStatusSchema = z.enum(['active', 'inactive']);
export type ScheduleStatus = z.infer<typeof ScheduleStatusSchema>;

export const ScheduleSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  status: ScheduleStatusSchema,
  timezone: z.string(),
  weekly_rules_json: z.array(WeeklyRuleSchema),
  holiday_overrides_json: z.array(HolidayOverrideSchema),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('Schedule');
export type Schedule = z.infer<typeof ScheduleSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateScheduleBodySchema = z.object({
  name: z.string().min(1),
  timezone: z.string().min(1),
  weekly_rules_json: z.array(WeeklyRuleSchema).optional(),
  holiday_overrides_json: z.array(HolidayOverrideSchema).optional(),
}).openapi('CreateScheduleBody');
export type CreateScheduleBody = z.infer<typeof CreateScheduleBodySchema>;

export const UpdateScheduleBodySchema = z.object({
  name: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
  weekly_rules_json: z.array(WeeklyRuleSchema).optional(),
  holiday_overrides_json: z.array(HolidayOverrideSchema).optional(),
  status: ScheduleStatusSchema.optional(),
}).openapi('UpdateScheduleBody');
export type UpdateScheduleBody = z.infer<typeof UpdateScheduleBodySchema>;
