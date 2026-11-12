import { describe, expect, it } from 'vitest';
import {
  diffLessons,
  findConflicts,
  planLessons,
  type ExistingLesson,
  type PlanRule,
  type PlannedLesson,
} from './schedule';

const rule = (overrides: Partial<PlanRule> = {}): PlanRule => ({
  id: 'r1',
  weekday: 1,
  startTime: '15:00',
  durationMin: 60,
  validFrom: '2026-01-01',
  validTo: null,
  ...overrides,
});

const plan = (overrides: Partial<Parameters<typeof planLessons>[0]> = {}) =>
  planLessons({
    rules: [rule()],
    // Monday 2026-11-16 … Sunday 2026-11-29.
    from: '2026-11-16',
    to: '2026-11-29',
    timeZone: 'Asia/Dushanbe',
    groupStartsOn: null,
    groupEndsOn: null,
    ...overrides,
  });

const starts = (lessons: { startsAt: Date }[]) => lessons.map((l) => l.startsAt.toISOString());

describe('planLessons', () => {
  it('places Monday and Thursday 15:00 Dushanbe lessons at 10:00 UTC', () => {
    const lessons = plan({ rules: [rule(), rule({ id: 'r2', weekday: 4 })] });
    expect(starts(lessons)).toEqual([
      '2026-11-16T10:00:00.000Z',
      '2026-11-19T10:00:00.000Z',
      '2026-11-23T10:00:00.000Z',
      '2026-11-26T10:00:00.000Z',
    ]);
    expect(lessons[1]).toMatchObject({ ruleId: 'r2', durationMin: 60 });
  });

  it('places the same rule at 12:00 UTC in Moscow', () => {
    expect(starts(plan({ timeZone: 'Europe/Moscow' }))[0]).toBe('2026-11-16T12:00:00.000Z');
  });

  it('keeps an early lesson on its local Monday', () => {
    expect(starts(plan({ rules: [rule({ startTime: '02:00' })] }))[0]).toBe(
      '2026-11-15T21:00:00.000Z',
    );
  });

  it('includes both ends of the range', () => {
    const lessons = plan({ from: '2026-11-16', to: '2026-11-23' });
    expect(starts(lessons)).toEqual(['2026-11-16T10:00:00.000Z', '2026-11-23T10:00:00.000Z']);
  });

  it('respects the rule validity dates', () => {
    expect(plan({ rules: [rule({ validTo: '2026-11-16' })] })).toHaveLength(1);
    expect(plan({ rules: [rule({ validFrom: '2026-11-17' })] })).toHaveLength(1);
  });

  it('respects the group dates', () => {
    expect(starts(plan({ groupEndsOn: '2026-11-22' }))).toEqual(['2026-11-16T10:00:00.000Z']);
    expect(starts(plan({ groupStartsOn: '2026-11-17' }))).toEqual(['2026-11-23T10:00:00.000Z']);
    // Group dates outside the range change nothing.
    expect(plan({ groupStartsOn: '2026-01-01', groupEndsOn: '2027-01-01' })).toHaveLength(2);
  });

  it('gives nothing for a weekday the range does not contain', () => {
    expect(plan({ rules: [rule({ weekday: 5 })], from: '2026-11-16', to: '2026-11-19' })).toEqual(
      [],
    );
  });

  it('keeps Berlin wall time across the clock changes', () => {
    const spring = plan({ timeZone: 'Europe/Berlin', from: '2026-03-23', to: '2026-04-05' });
    expect(starts(spring)).toEqual(['2026-03-23T14:00:00.000Z', '2026-03-30T13:00:00.000Z']);
    const autumn = plan({ timeZone: 'Europe/Berlin', from: '2026-10-19', to: '2026-11-01' });
    expect(starts(autumn)).toEqual(['2026-10-19T13:00:00.000Z', '2026-10-26T14:00:00.000Z']);
  });
});

describe('diffLessons', () => {
  const now = new Date('2026-11-17T00:00:00.000Z');
  const at = (value: string) => new Date(value);
  const planned = (startsAt: string, ruleId = 'r1'): PlannedLesson => ({
    ruleId,
    startsAt: at(startsAt),
    durationMin: 60,
  });
  const existing = (overrides: Partial<ExistingLesson> & { startsAt: Date }): ExistingLesson => ({
    id: overrides.startsAt.toISOString(),
    originalStartsAt: null,
    status: 'planned',
    scheduleRuleId: 'r1',
    hasAttendance: false,
    ...overrides,
  });
  const future = '2026-11-23T10:00:00.000Z';
  const later = '2026-11-30T10:00:00.000Z';

  it('changes nothing when the lessons match the plan', () => {
    expect(
      diffLessons({
        planned: [planned(future), planned(later)],
        existing: [existing({ startsAt: at(future) }), existing({ startsAt: at(later) })],
        now,
      }),
    ).toEqual({ toCreate: [], toDeleteIds: [] });
  });

  it('replaces future lessons when the time changes', () => {
    const moved = '2026-11-23T11:00:00.000Z';
    const result = diffLessons({
      planned: [planned(moved, 'r2')],
      existing: [existing({ startsAt: at(future) })],
      now,
    });
    expect(result.toDeleteIds).toEqual([future]);
    expect(starts(result.toCreate)).toEqual([moved]);
  });

  it('replaces a lesson in the same slot when its rule changes', () => {
    const result = diffLessons({
      planned: [planned(future, 'r2')],
      existing: [existing({ startsAt: at(future) })],
      now,
    });
    expect(result.toDeleteIds).toEqual([future]);
    expect(starts(result.toCreate)).toEqual([future]);
  });

  it('keeps a cancelled lesson and its slot', () => {
    expect(
      diffLessons({
        planned: [planned(future, 'r2')],
        existing: [existing({ startsAt: at(future), status: 'cancelled' })],
        now,
      }),
    ).toEqual({ toCreate: [], toDeleteIds: [] });
  });

  it('keeps a rescheduled lesson, and its original slot stays taken', () => {
    const result = diffLessons({
      planned: [planned(future), planned(later)],
      existing: [
        existing({
          startsAt: at('2026-11-24T10:00:00.000Z'),
          originalStartsAt: at(future),
        }),
      ],
      now,
    });
    expect(result.toDeleteIds).toEqual([]);
    expect(starts(result.toCreate)).toEqual([later]);
  });

  it('does not touch past lessons and does not create them', () => {
    const past = '2026-11-16T10:00:00.000Z';
    expect(
      diffLessons({
        planned: [planned(past, 'r2')],
        existing: [existing({ startsAt: at('2026-11-09T10:00:00.000Z') })],
        now,
      }),
    ).toEqual({ toCreate: [], toDeleteIds: [] });
  });

  it('keeps a lesson with attendance marks', () => {
    expect(
      diffLessons({
        planned: [],
        existing: [existing({ startsAt: at(future), hasAttendance: true })],
        now,
      }),
    ).toEqual({ toCreate: [], toDeleteIds: [] });
  });

  it('keeps a one-off lesson and its slot', () => {
    expect(
      diffLessons({
        planned: [planned(future)],
        existing: [existing({ startsAt: at(future), scheduleRuleId: null })],
        now,
      }),
    ).toEqual({ toCreate: [], toDeleteIds: [] });
  });

  it('removes every replaceable future lesson when the plan is empty', () => {
    expect(
      diffLessons({
        planned: [],
        existing: [existing({ startsAt: at(future) }), existing({ startsAt: at(later) })],
        now,
      }).toDeleteIds,
    ).toEqual([future, later]);
  });

  it('creates one lesson for two planned at the same moment', () => {
    const result = diffLessons({
      planned: [planned(future), planned(future, 'r2')],
      existing: [],
      now,
    });
    expect(result.toCreate).toEqual([planned(future)]);
  });
});

describe('findConflicts', () => {
  const lesson = (startsAt: string, durationMin = 60) => ({
    startsAt: new Date(startsAt),
    durationMin,
  });
  const mine = lesson('2026-11-19T10:00:00.000Z');

  it('finds overlapping lessons', () => {
    const other = lesson('2026-11-19T09:30:00.000Z');
    expect(findConflicts([mine], [other])).toEqual([{ mine, other }]);
    const inside = lesson('2026-11-19T10:15:00.000Z', 15);
    expect(findConflicts([mine], [inside])).toEqual([{ mine, other: inside }]);
  });

  it('does not count lessons that only touch', () => {
    const before = lesson('2026-11-19T09:00:00.000Z');
    const after = lesson('2026-11-19T11:00:00.000Z');
    expect(findConflicts([mine], [before, after])).toEqual([]);
  });
});
