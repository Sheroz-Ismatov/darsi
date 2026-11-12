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
