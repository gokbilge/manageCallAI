import { z } from '../registry.js';

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
  label: z.string().optional(),
}).openapi('HolidayOverride');
export type HolidayOverride = z.infer<typeof HolidayOverrideSchema>;

export const HolidayCalendarStatusSchema = z.enum(['active', 'inactive']);
export type HolidayCalendarStatus = z.infer<typeof HolidayCalendarStatusSchema>;

export const HolidayCalendarSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  schedule_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: HolidayCalendarStatusSchema,
  entries_json: z.array(HolidayOverrideSchema),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('HolidayCalendar');
export type HolidayCalendar = z.infer<typeof HolidayCalendarSchema>;

export const ScheduleOverrideStatusSchema = z.enum(['active', 'cancelled', 'expired']);
export type ScheduleOverrideStatus = z.infer<typeof ScheduleOverrideStatusSchema>;

export const ScheduleOverrideSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  schedule_id: z.string().uuid(),
  name: z.string(),
  reason: z.string().nullable(),
  status: ScheduleOverrideStatusSchema,
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  closed: z.boolean(),
  open_time: z.string().nullable().optional(),
  close_time: z.string().nullable().optional(),
  cancelled_at: z.string().datetime().nullable(),
  cancelled_by: z.string().uuid().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('ScheduleOverride');
export type ScheduleOverride = z.infer<typeof ScheduleOverrideSchema>;

export const ScheduleStatusSchema = z.enum(['active', 'inactive']);
export type ScheduleStatus = z.infer<typeof ScheduleStatusSchema>;

export const ScheduleSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: ScheduleStatusSchema,
  timezone: z.string(),
  weekly_rules_json: z.array(WeeklyRuleSchema),
  holiday_overrides_json: z.array(HolidayOverrideSchema),
  holiday_calendars: z.array(HolidayCalendarSchema),
  temporary_overrides: z.array(ScheduleOverrideSchema),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('Schedule');
export type Schedule = z.infer<typeof ScheduleSchema>;

export const CreateScheduleBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  timezone: z.string().min(1),
  weekly_rules_json: z.array(WeeklyRuleSchema).optional(),
  holiday_overrides_json: z.array(HolidayOverrideSchema).optional(),
}).openapi('CreateScheduleBody');
export type CreateScheduleBody = z.infer<typeof CreateScheduleBodySchema>;

export const UpdateScheduleBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  timezone: z.string().min(1).optional(),
  weekly_rules_json: z.array(WeeklyRuleSchema).optional(),
  holiday_overrides_json: z.array(HolidayOverrideSchema).optional(),
  status: ScheduleStatusSchema.optional(),
}).openapi('UpdateScheduleBody');
export type UpdateScheduleBody = z.infer<typeof UpdateScheduleBodySchema>;

export const CreateHolidayCalendarBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  entries_json: z.array(HolidayOverrideSchema).min(1),
}).openapi('CreateHolidayCalendarBody');
export type CreateHolidayCalendarBody = z.infer<typeof CreateHolidayCalendarBodySchema>;

export const UpdateHolidayCalendarBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: HolidayCalendarStatusSchema.optional(),
  entries_json: z.array(HolidayOverrideSchema).optional(),
}).openapi('UpdateHolidayCalendarBody');
export type UpdateHolidayCalendarBody = z.infer<typeof UpdateHolidayCalendarBodySchema>;

export const CreateScheduleOverrideBodySchema = z.object({
  name: z.string().min(1),
  reason: z.string().optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  closed: z.boolean(),
  open_time: z.string().optional(),
  close_time: z.string().optional(),
}).openapi('CreateScheduleOverrideBody');
export type CreateScheduleOverrideBody = z.infer<typeof CreateScheduleOverrideBodySchema>;

export const UpdateScheduleOverrideBodySchema = z.object({
  name: z.string().min(1).optional(),
  reason: z.string().nullable().optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  closed: z.boolean().optional(),
  open_time: z.string().nullable().optional(),
  close_time: z.string().nullable().optional(),
}).openapi('UpdateScheduleOverrideBody');
export type UpdateScheduleOverrideBody = z.infer<typeof UpdateScheduleOverrideBodySchema>;
