const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * «12 мая, 17:30». School screens pass the school's time zone (never the browser's);
 * platform screens have no school and fall back to the browser zone.
 */
export function formatDateTime(iso: string, timeZone?: string): string {
  const key = timeZone ?? '';
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('ru', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    });
    formatters.set(key, formatter);
  }
  return formatter.format(new Date(iso));
}

const dayFormatter = new Intl.DateTimeFormat('ru', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** «1 декабря 2026» for a calendar date `YYYY-MM-DD`: it has no time, so no zone shifts it. */
export function formatDay(date: string): string {
  return dayFormatter.format(new Date(`${date}T00:00:00Z`));
}
