import type { Schedule, ScheduleOverride } from './schedule.types.js';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function getLocalParts(now: Date, timezone: string): { date: string; dayOfWeek: number; timeHHMM: string } {
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });

  const date = dateFormatter.format(now);
  const rawTime = timeFormatter.format(now);
  const timeHHMM = rawTime.startsWith('24') ? '00' + rawTime.slice(2) : rawTime;
  const dayName = dayFormatter.format(now) as typeof DAY_NAMES[number];
  const dayOfWeek = DAY_NAMES.indexOf(dayName);

  return { date, dayOfWeek, timeHHMM };
}

export function isInBusinessHours(
  schedule: Pick<Schedule, 'timezone' | 'weekly_rules_json' | 'holiday_calendar_json' | 'override_windows_json'>,
  now: Date,
): boolean {
  let local: ReturnType<typeof getLocalParts>;
  try {
    local = getLocalParts(now, schedule.timezone);
  } catch {
    return false;
  }

  const { date, dayOfWeek, timeHHMM } = local;

  const activeOverride = resolveActiveOverride(schedule.override_windows_json, now);
  if (activeOverride) {
    if (activeOverride.mode === 'closed') return false;
    if (activeOverride.open_time && activeOverride.close_time) {
      return timeHHMM >= activeOverride.open_time && timeHHMM < activeOverride.close_time;
    }
    return false;
  }

  const holiday = schedule.holiday_calendar_json.find((h) => h.date === date);
  if (holiday) {
    if (holiday.closed) return false;
    if (holiday.open_time && holiday.close_time) {
      return timeHHMM >= holiday.open_time && timeHHMM < holiday.close_time;
    }
    return false;
  }

  const rule = schedule.weekly_rules_json.find((r) => r.day_of_week === dayOfWeek);
  if (!rule) return false;

  return timeHHMM >= rule.open_time && timeHHMM < rule.close_time;
}

function resolveActiveOverride(overrides: ScheduleOverride[], now: Date): ScheduleOverride | null {
  const active = overrides
    .filter((override) => {
      if (override.status !== 'active') return false;
      const startsAt = Date.parse(override.starts_at);
      const endsAt = Date.parse(override.ends_at);
      const time = now.getTime();
      return !Number.isNaN(startsAt) && !Number.isNaN(endsAt) && time >= startsAt && time < endsAt;
    })
    .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
  return active[0] ?? null;
}
