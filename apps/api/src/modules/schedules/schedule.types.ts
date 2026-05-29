export type WeeklyRule = {
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  open_time: string;
  close_time: string;
};

export type HolidayOverride = {
  date: string;
  closed: boolean;
  open_time?: string;
  close_time?: string;
};

export type Schedule = {
  id: string;
  tenant_id: string;
  name: string;
  status: 'active' | 'inactive';
  timezone: string;
  weekly_rules_json: WeeklyRule[];
  holiday_overrides_json: HolidayOverride[];
  created_at: Date;
  updated_at: Date;
};

export type CreateScheduleInput = {
  tenant_id: string;
  name: string;
  timezone: string;
  weekly_rules_json?: WeeklyRule[];
  holiday_overrides_json?: HolidayOverride[];
};

export type UpdateScheduleInput = {
  name?: string;
  timezone?: string;
  weekly_rules_json?: WeeklyRule[];
  holiday_overrides_json?: HolidayOverride[];
  status?: 'active' | 'inactive';
};
