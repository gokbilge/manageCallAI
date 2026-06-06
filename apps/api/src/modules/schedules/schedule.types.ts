export type WeeklyRule = {
  day_of_week: number;
  open_time: string;
  close_time: string;
};

export type HolidayOverride = {
  date: string;
  closed: boolean;
  open_time?: string;
  close_time?: string;
  label?: string;
};

export type HolidayCalendarStatus = 'active' | 'inactive';

export type HolidayCalendar = {
  id: string;
  tenant_id: string;
  schedule_id: string;
  name: string;
  description: string | null;
  status: HolidayCalendarStatus;
  entries_json: HolidayOverride[];
  created_at: Date;
  updated_at: Date;
};

export type ScheduleOverrideStatus = 'active' | 'cancelled' | 'expired';

export type ScheduleOverride = {
  id: string;
  tenant_id: string;
  schedule_id: string;
  name: string;
  reason: string | null;
  status: ScheduleOverrideStatus;
  starts_at: Date;
  ends_at: Date;
  closed: boolean;
  open_time?: string | null;
  close_time?: string | null;
  cancelled_at: Date | null;
  cancelled_by: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type Schedule = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  timezone: string;
  weekly_rules_json: WeeklyRule[];
  holiday_overrides_json: HolidayOverride[];
  holiday_calendars: HolidayCalendar[];
  temporary_overrides: ScheduleOverride[];
  created_at: Date;
  updated_at: Date;
};

export type CreateScheduleInput = {
  tenant_id: string;
  name: string;
  description?: string;
  timezone: string;
  weekly_rules_json?: WeeklyRule[];
  holiday_overrides_json?: HolidayOverride[];
};

export type UpdateScheduleInput = {
  name?: string;
  description?: string | null;
  timezone?: string;
  weekly_rules_json?: WeeklyRule[];
  holiday_overrides_json?: HolidayOverride[];
  status?: 'active' | 'inactive';
};

export type CreateHolidayCalendarInput = {
  tenant_id: string;
  schedule_id: string;
  name: string;
  description?: string;
  entries_json: HolidayOverride[];
};

export type UpdateHolidayCalendarInput = {
  name?: string;
  description?: string | null;
  status?: HolidayCalendarStatus;
  entries_json?: HolidayOverride[];
};

export type CreateScheduleOverrideInput = {
  tenant_id: string;
  schedule_id: string;
  name: string;
  reason?: string;
  starts_at: string;
  ends_at: string;
  closed: boolean;
  open_time?: string;
  close_time?: string;
  created_by?: string;
};

export type UpdateScheduleOverrideInput = {
  name?: string;
  reason?: string | null;
  starts_at?: string;
  ends_at?: string;
  closed?: boolean;
  open_time?: string | null;
  close_time?: string | null;
};
