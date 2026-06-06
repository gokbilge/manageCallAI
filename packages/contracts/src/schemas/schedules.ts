import { z } from '../registry.js';

// ── Resource schemas ──────────────────────────────────────────────────────────
export const WeeklyRuleSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  open_time: z.string(),
  close_time: z.string(),
}).openapi('WeeklyRule');
export type WeeklyRule = z.infer<typeof WeeklyRuleSchema>;

export const HolidayCalendarEntrySchema = z.object({
  date: z.string(),
  closed: z.boolean(),
  open_time: z.string().optional(),
  close_time: z.string().optional(),
  name: z.string().optional(),
}).openapi('HolidayCalendarEntry');
export type HolidayCalendarEntry = z.infer<typeof HolidayCalendarEntrySchema>;

export const HolidayOverrideSchema = HolidayCalendarEntrySchema.openapi('HolidayOverride');
export type HolidayOverride = z.infer<typeof HolidayOverrideSchema>;

export const ScheduleStatusSchema = z.enum(['active', 'inactive']);
export type ScheduleStatus = z.infer<typeof ScheduleStatusSchema>;

export const ScheduleGroupSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: ScheduleStatusSchema,
  weekly_rules_json: z.array(WeeklyRuleSchema),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('ScheduleGroup');
export type ScheduleGroup = z.infer<typeof ScheduleGroupSchema>;

export const HolidayCalendarSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: ScheduleStatusSchema,
  entries_json: z.array(HolidayCalendarEntrySchema),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('HolidayCalendar');
export type HolidayCalendar = z.infer<typeof HolidayCalendarSchema>;

export const ScheduleOverrideModeSchema = z.enum(['closed', 'custom_hours']);
export type ScheduleOverrideMode = z.infer<typeof ScheduleOverrideModeSchema>;

export const ScheduleOverrideLifecycleStateSchema = z.enum(['scheduled', 'active', 'expired', 'cancelled']);
export type ScheduleOverrideLifecycleState = z.infer<typeof ScheduleOverrideLifecycleStateSchema>;

export const ScheduleOverrideSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  schedule_id: z.string().uuid(),
  name: z.string(),
  reason: z.string().nullable(),
  mode: ScheduleOverrideModeSchema,
  open_time: z.string().nullable(),
  close_time: z.string().nullable(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  lifecycle_state: ScheduleOverrideLifecycleStateSchema,
  cancelled_at: z.string().datetime().nullable(),
  cancelled_by: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('ScheduleOverride');
export type ScheduleOverride = z.infer<typeof ScheduleOverrideSchema>;

export const ScheduleSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  status: ScheduleStatusSchema,
  timezone: z.string(),
  schedule_group_id: z.string().uuid().nullable(),
  holiday_calendar_id: z.string().uuid().nullable(),
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
  schedule_group_id: z.string().uuid().nullable().optional(),
  holiday_calendar_id: z.string().uuid().nullable().optional(),
  weekly_rules_json: z.array(WeeklyRuleSchema).optional(),
  holiday_overrides_json: z.array(HolidayOverrideSchema).optional(),
}).openapi('CreateScheduleBody');
export type CreateScheduleBody = z.infer<typeof CreateScheduleBodySchema>;

export const UpdateScheduleBodySchema = z.object({
  name: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
  schedule_group_id: z.string().uuid().nullable().optional(),
  holiday_calendar_id: z.string().uuid().nullable().optional(),
  weekly_rules_json: z.array(WeeklyRuleSchema).optional(),
  holiday_overrides_json: z.array(HolidayOverrideSchema).optional(),
  status: ScheduleStatusSchema.optional(),
}).openapi('UpdateScheduleBody');
export type UpdateScheduleBody = z.infer<typeof UpdateScheduleBodySchema>;

export const CreateScheduleGroupBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().max(500).nullable().optional(),
  weekly_rules_json: z.array(WeeklyRuleSchema).min(1),
  status: ScheduleStatusSchema.optional(),
}).openapi('CreateScheduleGroupBody');
export type CreateScheduleGroupBody = z.infer<typeof CreateScheduleGroupBodySchema>;

export const UpdateScheduleGroupBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().max(500).nullable().optional(),
  weekly_rules_json: z.array(WeeklyRuleSchema).min(1).optional(),
  status: ScheduleStatusSchema.optional(),
}).openapi('UpdateScheduleGroupBody');
export type UpdateScheduleGroupBody = z.infer<typeof UpdateScheduleGroupBodySchema>;

export const CreateHolidayCalendarBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().max(500).nullable().optional(),
  entries_json: z.array(HolidayCalendarEntrySchema).min(1),
  status: ScheduleStatusSchema.optional(),
}).openapi('CreateHolidayCalendarBody');
export type CreateHolidayCalendarBody = z.infer<typeof CreateHolidayCalendarBodySchema>;

export const UpdateHolidayCalendarBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().max(500).nullable().optional(),
  entries_json: z.array(HolidayCalendarEntrySchema).min(1).optional(),
  status: ScheduleStatusSchema.optional(),
}).openapi('UpdateHolidayCalendarBody');
export type UpdateHolidayCalendarBody = z.infer<typeof UpdateHolidayCalendarBodySchema>;

export const CreateScheduleOverrideBodySchema = z.object({
  name: z.string().min(1),
  reason: z.string().max(500).nullable().optional(),
  mode: ScheduleOverrideModeSchema,
  open_time: z.string().nullable().optional(),
  close_time: z.string().nullable().optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
}).openapi('CreateScheduleOverrideBody');
export type CreateScheduleOverrideBody = z.infer<typeof CreateScheduleOverrideBodySchema>;

export const CancelScheduleOverrideBodySchema = z.object({
  reason: z.string().max(500).nullable().optional(),
}).openapi('CancelScheduleOverrideBody');
export type CancelScheduleOverrideBody = z.infer<typeof CancelScheduleOverrideBodySchema>;
