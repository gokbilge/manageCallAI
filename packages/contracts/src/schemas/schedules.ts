import { z } from '../registry.js';

export const WeeklyRuleSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  open_time: z.string(),
  close_time: z.string(),
}).openapi('WeeklyRule');
export type WeeklyRule = z.infer<typeof WeeklyRuleSchema>;

export const HolidayCalendarEntrySchema = z.object({
  date: z.string(),
  name: z.string().min(1),
  closed: z.boolean(),
  open_time: z.string().optional(),
  close_time: z.string().optional(),
}).openapi('HolidayCalendarEntry');
export type HolidayCalendarEntry = z.infer<typeof HolidayCalendarEntrySchema>;

export const ScheduleOverrideModeSchema = z.enum(['closed', 'custom_hours']);
export type ScheduleOverrideMode = z.infer<typeof ScheduleOverrideModeSchema>;

export const ScheduleOverrideStatusSchema = z.enum(['active', 'revoked']);
export type ScheduleOverrideStatus = z.infer<typeof ScheduleOverrideStatusSchema>;

export const ScheduleOverrideSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  reason: z.string().nullable(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  mode: ScheduleOverrideModeSchema,
  open_time: z.string().optional(),
  close_time: z.string().optional(),
  status: ScheduleOverrideStatusSchema,
  created_by_user_id: z.string().nullable(),
  created_at: z.string().datetime(),
  revoked_by_user_id: z.string().nullable(),
  revoked_at: z.string().datetime().nullable(),
}).openapi('ScheduleOverride');
export type ScheduleOverride = z.infer<typeof ScheduleOverrideSchema>;

export const ScheduleStatusSchema = z.enum(['active', 'inactive']);
export type ScheduleStatus = z.infer<typeof ScheduleStatusSchema>;

export const ScheduleSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  status: ScheduleStatusSchema,
  description: z.string().nullable(),
  timezone: z.string(),
  weekly_rules_json: z.array(WeeklyRuleSchema),
  holiday_calendar_name: z.string().nullable(),
  holiday_calendar_json: z.array(HolidayCalendarEntrySchema),
  override_windows_json: z.array(ScheduleOverrideSchema),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('Schedule');
export type Schedule = z.infer<typeof ScheduleSchema>;

export const CreateScheduleBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  timezone: z.string().min(1),
  weekly_rules_json: z.array(WeeklyRuleSchema).optional(),
  holiday_calendar_name: z.string().optional().nullable(),
  holiday_calendar_json: z.array(HolidayCalendarEntrySchema).optional(),
}).openapi('CreateScheduleBody');
export type CreateScheduleBody = z.infer<typeof CreateScheduleBodySchema>;

export const UpdateScheduleBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  timezone: z.string().min(1).optional(),
  weekly_rules_json: z.array(WeeklyRuleSchema).optional(),
  holiday_calendar_name: z.string().optional().nullable(),
  holiday_calendar_json: z.array(HolidayCalendarEntrySchema).optional(),
  status: ScheduleStatusSchema.optional(),
}).openapi('UpdateScheduleBody');
export type UpdateScheduleBody = z.infer<typeof UpdateScheduleBodySchema>;

export const CreateScheduleOverrideBodySchema = z.object({
  name: z.string().min(1),
  reason: z.string().optional().nullable(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  mode: ScheduleOverrideModeSchema,
  open_time: z.string().optional(),
  close_time: z.string().optional(),
}).openapi('CreateScheduleOverrideBody');
export type CreateScheduleOverrideBody = z.infer<typeof CreateScheduleOverrideBodySchema>;
