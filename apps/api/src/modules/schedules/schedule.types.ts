export type WeeklyRule = {
  day_of_week: number;
  open_time: string;
  close_time: string;
};

export type HolidayCalendarEntry = {
  date: string;
  closed: boolean;
  open_time?: string;
  close_time?: string;
  name?: string;
};

export type HolidayOverride = HolidayCalendarEntry;

export type ScheduleStatus = 'active' | 'inactive';

export type ScheduleGroup = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: ScheduleStatus;
  weekly_rules_json: WeeklyRule[];
  created_at: Date;
  updated_at: Date;
};

export type HolidayCalendar = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: ScheduleStatus;
  entries_json: HolidayCalendarEntry[];
  created_at: Date;
  updated_at: Date;
};

export type ScheduleOverrideMode = 'closed' | 'custom_hours';
export type ScheduleOverrideLifecycleState = 'scheduled' | 'active' | 'expired' | 'cancelled';

export type ScheduleOverrideRecord = {
  id: string;
  tenant_id: string;
  schedule_id: string;
  name: string;
  reason: string | null;
  mode: ScheduleOverrideMode;
  open_time: string | null;
  close_time: string | null;
  starts_at: Date;
  ends_at: Date;
  cancelled_at: Date | null;
  cancelled_by: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ScheduleOverride = ScheduleOverrideRecord & {
  lifecycle_state: ScheduleOverrideLifecycleState;
};

export type Schedule = {
  id: string;
  tenant_id: string;
  name: string;
  status: ScheduleStatus;
  timezone: string;
  schedule_group_id: string | null;
  holiday_calendar_id: string | null;
  weekly_rules_json: WeeklyRule[];
  holiday_overrides_json: HolidayOverride[];
  created_at: Date;
  updated_at: Date;
};

export type CreateScheduleGroupInput = {
  tenant_id: string;
  name: string;
  description?: string | null;
  status?: ScheduleStatus;
  weekly_rules_json: WeeklyRule[];
};

export type UpdateScheduleGroupInput = {
  name?: string;
  description?: string | null;
  status?: ScheduleStatus;
  weekly_rules_json?: WeeklyRule[];
};

export type CreateHolidayCalendarInput = {
  tenant_id: string;
  name: string;
  description?: string | null;
  status?: ScheduleStatus;
  entries_json: HolidayCalendarEntry[];
};

export type UpdateHolidayCalendarInput = {
  name?: string;
  description?: string | null;
  status?: ScheduleStatus;
  entries_json?: HolidayCalendarEntry[];
};

export type CreateScheduleInput = {
  tenant_id: string;
  name: string;
  timezone: string;
  schedule_group_id?: string | null;
  holiday_calendar_id?: string | null;
  weekly_rules_json?: WeeklyRule[];
  holiday_overrides_json?: HolidayOverride[];
};

export type UpdateScheduleInput = {
  name?: string;
  timezone?: string;
  status?: ScheduleStatus;
  schedule_group_id?: string | null;
  holiday_calendar_id?: string | null;
  weekly_rules_json?: WeeklyRule[];
  holiday_overrides_json?: HolidayOverride[];
};

export type CreateScheduleOverrideInput = {
  tenant_id: string;
  schedule_id: string;
  name: string;
  reason?: string | null;
  mode: ScheduleOverrideMode;
  open_time?: string | null;
  close_time?: string | null;
  starts_at: string;
  ends_at: string;
  created_by?: string | null;
};

export type CancelScheduleOverrideInput = {
  reason?: string | null;
  cancelled_by?: string | null;
};
