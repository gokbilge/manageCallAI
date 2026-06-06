import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

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

export type Schedule = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  timezone: string;
  schedule_group_id: string | null;
  holiday_calendar_id: string | null;
  weekly_rules_json: WeeklyRule[];
  holiday_overrides_json: HolidayCalendarEntry[];
  created_at: string;
  updated_at: string;
};

export type ScheduleGroup = {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  weekly_rules_json: WeeklyRule[];
  created_at: string;
  updated_at: string;
};

export type HolidayCalendar = {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  entries_json: HolidayCalendarEntry[];
  created_at: string;
  updated_at: string;
};

export type ScheduleOverride = {
  id: string;
  schedule_id: string;
  name: string;
  reason: string | null;
  mode: 'closed' | 'custom_hours';
  open_time: string | null;
  close_time: string | null;
  starts_at: string;
  ends_at: string;
  lifecycle_state: 'scheduled' | 'active' | 'expired' | 'cancelled';
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function useTenantQuery<T>(key: string[], path: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...key, session?.claims.tenant_id],
    enabled: Boolean(session?.token),
    queryFn: async () => {
      const result = await apiRequest<{ data: T }>(path, { accessToken: session!.token });
      return result.data;
    },
  });
}

export function useSchedules() {
  return useTenantQuery<Schedule[]>(['schedules'], '/schedules');
}

export function useScheduleGroups() {
  return useTenantQuery<ScheduleGroup[]>(['schedule-groups'], '/schedules/groups');
}

export function useHolidayCalendars() {
  return useTenantQuery<HolidayCalendar[]>(['holiday-calendars'], '/schedules/holiday-calendars');
}

export function useScheduleOverrides(scheduleId: string | null) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['schedule-overrides', session?.claims.tenant_id, scheduleId],
    enabled: Boolean(session?.token && scheduleId),
    queryFn: async () => {
      const result = await apiRequest<{ data: ScheduleOverride[] }>(`/schedules/${scheduleId}/overrides`, {
        accessToken: session!.token,
      });
      return result.data;
    },
  });
}
