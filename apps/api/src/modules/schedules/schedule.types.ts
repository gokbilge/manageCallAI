export type WeeklyRule = {
  day_of_week: number;
  open_time: string;
  close_time: string;
};

export type HolidayCalendarEntry = {
  date: string;
  name: string;
  closed: boolean;
  open_time?: string;
  close_time?: string;
};

export type ScheduleOverrideMode = 'closed' | 'custom_hours';
export type ScheduleOverrideStatus = 'active' | 'revoked';

export type ScheduleOverride = {
  id: string;
  name: string;
  reason: string | null;
  starts_at: string;
  ends_at: string;
  mode: ScheduleOverrideMode;
  open_time?: string;
  close_time?: string;
  status: ScheduleOverrideStatus;
  created_by_user_id: string | null;
  created_at: string;
  revoked_by_user_id: string | null;
  revoked_at: string | null;
};

export type Schedule = {
  id: string;
  tenant_id: string;
  name: string;
  status: 'active' | 'inactive';
  description: string | null;
  timezone: string;
  weekly_rules_json: WeeklyRule[];
  holiday_calendar_name: string | null;
  holiday_calendar_json: HolidayCalendarEntry[];
  override_windows_json: ScheduleOverride[];
  created_at: Date;
  updated_at: Date;
};

export type CreateScheduleInput = {
  tenant_id: string;
  name: string;
  description?: string | null;
  timezone: string;
  weekly_rules_json?: WeeklyRule[];
  holiday_calendar_name?: string | null;
  holiday_calendar_json?: HolidayCalendarEntry[];
};

export type UpdateScheduleInput = {
  name?: string;
  description?: string | null;
  timezone?: string;
  weekly_rules_json?: WeeklyRule[];
  holiday_calendar_name?: string | null;
  holiday_calendar_json?: HolidayCalendarEntry[];
  status?: 'active' | 'inactive';
};

export type CreateScheduleOverrideInput = {
  name: string;
  reason?: string | null;
  starts_at: string;
  ends_at: string;
  mode: ScheduleOverrideMode;
  open_time?: string;
  close_time?: string;
  actor_user_id: string | null;
};
