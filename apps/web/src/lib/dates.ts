/**
 * Lesson dates and times in the school's time zone. Lessons are never shown in the browser's
 * zone: an admin travelling or with a misconfigured laptop must see what parents see.
 */
const cache = new Map<string, Intl.DateTimeFormat>();

const formatter = (timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let value = cache.get(key);
  if (!value) {
    value = new Intl.DateTimeFormat('ru', { ...options, timeZone });
    cache.set(key, value);
  }
  return value;
};

/** «чт, 14 мая». */
export function formatLessonDay(iso: string, timeZone: string): string {
  return formatter(timeZone, { weekday: 'short', day: 'numeric', month: 'long' }).format(
    new Date(iso),
  );
}

/** «15:00». */
export function formatLessonTime(iso: string, timeZone: string): string {
  return formatter(timeZone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(iso),
  );
}

/** «14:30–15:30». */
export function formatLessonRange(iso: string, durationMin: number, timeZone: string): string {
  const end = new Date(Date.parse(iso) + durationMin * 60_000).toISOString();
  return `${formatLessonTime(iso, timeZone)}–${formatLessonTime(end, timeZone)}`;
}

/** «14 мая, 15:00». */
export function formatLessonMoment(iso: string, timeZone: string): string {
  return formatter(timeZone, {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

// Calendar dates `YYYY-MM-DD` are already in the school's zone: they are read as UTC midnight
// so that no zone shifts them.
const calendarDate = (date: string): Date => new Date(`${date}T00:00:00Z`);

/** «пн» — the short weekday of a calendar date. */
export function formatWeekdayShort(date: string): string {
  return formatter('UTC', { weekday: 'short' }).format(calendarDate(date));
}

/** «четверг, 14 мая». */
export function formatDayLong(date: string): string {
  return formatter('UTC', { weekday: 'long', day: 'numeric', month: 'long' }).format(
    calendarDate(date),
  );
}

/** «12–18 мая», «28 апреля – 4 мая», «29 декабря 2026 г. – 4 января 2027 г.». */
export function formatPeriod(from: string, to: string): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return formatter('UTC', {
    day: 'numeric',
    month: 'long',
    ...(!sameYear && { year: 'numeric' }),
  }).formatRange(calendarDate(from), calendarDate(to));
}
