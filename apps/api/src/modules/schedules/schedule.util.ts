import type { HolidayCalendar, Schedule, ScheduleOverride } from './schedule.types.js';

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

function evaluateClosedOrWindow(input: {
  closed: boolean;
  timeHHMM: string;
  open_time?: string | null;
  close_time?: string | null;
}): boolean {
  if (input.closed) {
    return false;
  }
  if (input.open_time && input.close_time) {
    return input.timeHHMM >= input.open_time && input.timeHHMM < input.close_time;
  }
  return false;
}

function findHolidayEntry(
  date: string,
  legacyEntries: Pick<Schedule, 'holiday_overrides_json'>['holiday_overrides_json'],
  calendars: Array<Pick<HolidayCalendar, 'status' | 'entries_json'>>,
) {
  for (const calendar of calendars) {
    if (calendar.status !== 'active') {
      continue;
    }
    const entry = calendar.entries_json.find((candidate) => candidate.date === date);
    if (entry) {
      return entry;
    }
  }
  return legacyEntries.find((entry) => entry.date === date);
}

function findActiveOverride(
  now: Date,
  overrides: Array<Pick<ScheduleOverride, 'status' | 'starts_at' | 'ends_at' | 'closed' | 'open_time' | 'close_time'>>,
) {
  for (const override of overrides) {
    if (override.status !== 'active') {
      continue;
    }
    if (now >= override.starts_at && now < override.ends_at) {
      return override;
    }
  }
  return null;
}

export function isInBusinessHours(
  schedule: Pick<
    Schedule,
    'timezone' | 'weekly_rules_json' | 'holiday_overrides_json' | 'holiday_calendars' | 'temporary_overrides'
  >,
  now: Date,
): boolean {
  let local: ReturnType<typeof getLocalParts>;
  try {
    local = getLocalParts(now, schedule.timezone);
  } catch {
    return false;
  }

  const { date, dayOfWeek, timeHHMM } = local;

  const override = findActiveOverride(now, schedule.temporary_overrides ?? []);
  if (override) {
    return evaluateClosedOrWindow({
      closed: override.closed,
      timeHHMM,
      open_time: override.open_time,
      close_time: override.close_time,
    });
  }

  const holiday = findHolidayEntry(
    date,
    schedule.holiday_overrides_json ?? [],
    schedule.holiday_calendars ?? [],
  );
  if (holiday) {
    return evaluateClosedOrWindow({
      closed: holiday.closed,
      timeHHMM,
      open_time: holiday.open_time,
      close_time: holiday.close_time,
    });
  }

  const rule = schedule.weekly_rules_json.find((candidate) => candidate.day_of_week === dayOfWeek);
  if (!rule) return false;

  return timeHHMM >= rule.open_time && timeHHMM < rule.close_time;
}
