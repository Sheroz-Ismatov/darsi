import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, todayIn, utcToZoned, weekdayOf, zonedDateTimeToUtc } from './time';

const iso = (date: Date) => date.toISOString();

describe('zonedDateTimeToUtc', () => {
  it('converts Dushanbe (+5) wall time to UTC', () => {
    // 2026-11-16 is a Monday.
    expect(iso(zonedDateTimeToUtc('2026-11-16', '09:00', 'Asia/Dushanbe'))).toBe(
      '2026-11-16T04:00:00.000Z',
    );
  });

  it('moves an early Dushanbe lesson to the previous UTC day', () => {
    const instant = zonedDateTimeToUtc('2026-11-16', '02:00', 'Asia/Dushanbe');
    expect(iso(instant)).toBe('2026-11-15T21:00:00.000Z');
    expect(utcToZoned(instant, 'Asia/Dushanbe')).toEqual({
      date: '2026-11-16',
      time: '02:00',
      weekday: 1,
    });
  });

  it('converts Moscow (+3) wall time to UTC', () => {
    expect(iso(zonedDateTimeToUtc('2026-11-16', '09:00', 'Europe/Moscow'))).toBe(
      '2026-11-16T06:00:00.000Z',
    );
    const instant = zonedDateTimeToUtc('2026-11-16', '02:00', 'Europe/Moscow');
    expect(iso(instant)).toBe('2026-11-15T23:00:00.000Z');
    expect(utcToZoned(instant, 'Europe/Moscow')).toMatchObject({ date: '2026-11-16', weekday: 1 });
  });

  it('keeps Berlin wall time across the spring and autumn clock changes', () => {
    // Clocks go forward on 2026-03-29 and back on 2026-10-25.
    expect(iso(zonedDateTimeToUtc('2026-03-28', '15:00', 'Europe/Berlin'))).toBe(
      '2026-03-28T14:00:00.000Z',
    );
    expect(iso(zonedDateTimeToUtc('2026-03-29', '15:00', 'Europe/Berlin'))).toBe(
      '2026-03-29T13:00:00.000Z',
    );
    expect(iso(zonedDateTimeToUtc('2026-10-24', '15:00', 'Europe/Berlin'))).toBe(
      '2026-10-24T13:00:00.000Z',
    );
    expect(iso(zonedDateTimeToUtc('2026-10-25', '15:00', 'Europe/Berlin'))).toBe(
      '2026-10-25T14:00:00.000Z',
    );
  });

  it('resolves a skipped time to the first moment after the gap', () => {
    // 02:00–03:00 does not exist in Berlin on 2026-03-29.
    const instant = zonedDateTimeToUtc('2026-03-29', '02:30', 'Europe/Berlin');
    expect(iso(instant)).toBe('2026-03-29T01:00:00.000Z');
    expect(utcToZoned(instant, 'Europe/Berlin').time).toBe('03:00');
  });

  it('resolves a repeated time to its first occurrence', () => {
    // 02:00–03:00 happens twice in Berlin on 2026-10-25: first at +2, then at +1.
    expect(iso(zonedDateTimeToUtc('2026-10-25', '02:30', 'Europe/Berlin'))).toBe(
      '2026-10-25T00:30:00.000Z',
    );
  });
});

describe('utcToZoned', () => {
  it('reads the wall clock and ISO weekday', () => {
    expect(utcToZoned(new Date('2026-11-22T10:15:30.500Z'), 'Asia/Dushanbe')).toEqual({
      date: '2026-11-22',
      time: '15:15',
      weekday: 7,
    });
  });
});

describe('dates', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-11-01', '2026-12-31')).toBe(60);
    expect(daysBetween('2026-11-02', '2026-11-01')).toBe(-1);
  });

  it('gives ISO weekdays', () => {
    expect(weekdayOf('2026-11-16')).toBe(1);
    expect(weekdayOf('2026-11-22')).toBe(7);
  });

  it('gives today in the school zone, not in UTC', () => {
    const now = new Date('2026-11-15T20:30:00.000Z');
    expect(todayIn('Asia/Dushanbe', now)).toBe('2026-11-16');
    expect(todayIn('Europe/Moscow', now)).toBe('2026-11-15');
  });
});
