/** A calendar date, `YYYY-MM-DD`. */
export type DateString = string;
/** A wall-clock time, `HH:mm`. */
export type TimeString = string;

export interface ZonedDateTime {
  date: DateString;
  time: TimeString;
  /** ISO weekday: 1 is Monday, 7 is Sunday. */
  weekday: number;
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

const formatters = new Map<string, Intl.DateTimeFormat>();

// Creating a formatter is costly; generation calls this for every lesson of every group.
const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
};

/** Local wall-clock fields of an instant, read back as if they were UTC. */
const wallClockMs = (instant: number, timeZone: string): number => {
  const fields: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(new Date(instant))) {
    if (part.type !== 'literal') fields[part.type] = Number(part.value);
  }
  return Date.UTC(
    fields.year!,
    fields.month! - 1,
    fields.day!,
    fields.hour!,
    fields.minute!,
    fields.second!,
  );
};

/**
 * Offset of the zone from UTC at a whole-minute instant, in milliseconds (positive east of
 * Greenwich).
 */
const offsetMs = (instant: number, timeZone: string): number =>
  wallClockMs(instant, timeZone) - instant;

const parseDate = (date: DateString): number => Date.parse(`${date}T00:00:00Z`);

const pad = (value: number): string => String(value).padStart(2, '0');

/** ISO weekday of a calendar date (1 — Monday). */
export function weekdayOf(date: DateString): number {
  return ((new Date(parseDate(date)).getUTCDay() + 6) % 7) + 1;
}

export function addDays(date: DateString, days: number): DateString {
  return new Date(parseDate(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: DateString, to: DateString): number {
  return Math.round((parseDate(to) - parseDate(from)) / DAY_MS);
}

export function utcToZoned(instant: Date, timeZone: string): ZonedDateTime {
  const local = new Date(wallClockMs(instant.getTime(), timeZone));
  const date = local.toISOString().slice(0, 10);
  return {
    date,
    time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
    weekday: weekdayOf(date),
  };
}

export function todayIn(timeZone: string, now: Date): DateString {
  return utcToZoned(now, timeZone).date;
}

/**
 * The instant a school's wall clock shows `date time`. A time skipped by a clock change resolves
 * to the first moment after the gap; a time that happens twice resolves to its first occurrence.
 */
export function zonedDateTimeToUtc(date: DateString, time: TimeString, timeZone: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const wall = parseDate(date) + (hours! * 60 + minutes!) * MINUTE_MS;
  // Zones change their offset at most once within a day, so the offsets a day around the
  // wanted time are the only ones it can have.
  const before = offsetMs(wall - DAY_MS, timeZone);
  const after = offsetMs(wall + DAY_MS, timeZone);
  const candidates = [wall - before, wall - after].filter(
    (instant) => wallClockMs(instant, timeZone) === wall,
  );
  if (candidates.length > 0) return new Date(Math.min(...candidates));

  // In a gap: find the transition, i.e. the first minute that already has the new offset.
  let low = wall - after;
  let high = wall - before;
  while (high - low > MINUTE_MS) {
    const middle = low + Math.floor((high - low) / 2 / MINUTE_MS) * MINUTE_MS;
    if (offsetMs(middle, timeZone) === after) high = middle;
    else low = middle;
  }
  return new Date(high);
}
