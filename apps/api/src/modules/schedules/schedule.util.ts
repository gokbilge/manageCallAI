import type { Schedule } from './schedule.types.js';

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
  schedule: Pick<Schedule, 'timezone' | 'weekly_rules_json' | 'holiday_overrides_json'>,
  now: Date,
): boolean {
  let local: ReturnType<typeof getLocalParts>;
  try {
    local = getLocalParts(now, schedule.timezone);
  } catch {
    return false;
  }

  const { date, dayOfWeek, timeHHMM } = local;

  const holiday = schedule.holiday_overrides_json.find((h) => h.date === date);
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
