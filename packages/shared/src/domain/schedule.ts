import { addDays, weekdayOf, zonedDateTimeToUtc, type DateString, type TimeString } from './time';

/** A stored schedule rule as generation reads it. */
export interface PlanRule {
  id: string;
  /** ISO weekday, 1 — Monday. */
  weekday: number;
  /** Wall-clock time of the school. */
  startTime: TimeString;
  durationMin: number;
  validFrom: DateString;
  validTo: DateString | null;
}

export interface PlannedLesson {
  ruleId: string;
  startsAt: Date;
  durationMin: number;
}

export interface ExistingLesson {
  id: string;
  startsAt: Date;
  originalStartsAt: Date | null;
  status: 'planned' | 'done' | 'cancelled';
  scheduleRuleId: string | null;
  hasAttendance: boolean;
}

export interface TimedLesson {
  startsAt: Date;
  durationMin: number;
}

const later = (a: DateString, b: DateString | null): DateString => (b !== null && b > a ? b : a);
const earlier = (a: DateString, b: DateString | null): DateString => (b !== null && b < a ? b : a);

/**
 * Every lesson the rules give for the dates `from…to` inclusive, in the school's zone, within the
 * rule's and the group's own dates. Sorted by start.
 */
export function planLessons(input: {
  rules: PlanRule[];
  from: DateString;
  to: DateString;
  timeZone: string;
  groupStartsOn: DateString | null;
  groupEndsOn: DateString | null;
}): PlannedLesson[] {
  const first = later(input.from, input.groupStartsOn);
  const last = earlier(input.to, input.groupEndsOn);
  const lessons: PlannedLesson[] = [];
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const weekday = weekdayOf(date);
    for (const rule of input.rules) {
      const valid = rule.validFrom <= date && (rule.validTo === null || date <= rule.validTo);
      if (rule.weekday !== weekday || !valid) continue;
      lessons.push({
        ruleId: rule.id,
        startsAt: zonedDateTimeToUtc(date, rule.startTime, input.timeZone),
        durationMin: rule.durationMin,
      });
    }
  }
  return lessons.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/**
 * Lessons the generator may remove: produced by a rule, still planned, in the future, never
 * rescheduled and without attendance marks (T-16, decision 3).
 */
const isReplaceable = (lesson: ExistingLesson, now: Date): boolean =>
  lesson.scheduleRuleId !== null &&
  lesson.status === 'planned' &&
  lesson.startsAt.getTime() > now.getTime() &&
  lesson.originalStartsAt === null &&
  !lesson.hasAttendance;

const lessonKey = (startsAt: Date, ruleId: string | null): string =>
  `${startsAt.getTime()}|${ruleId}`;

/**
 * What to change so that the stored lessons match the plan. A matching lesson (same start, same
 * rule) is kept with its id. A slot stays taken by any lesson that is kept, a cancelled one
 * included, and by the original time of a rescheduled one (T-16, decisions 2–4).
 *
 * The rule id stands for its duration too: a rule whose duration changes is a new rule row.
 */
export function diffLessons(input: {
  planned: PlannedLesson[];
  existing: ExistingLesson[];
  now: Date;
}): { toCreate: PlannedLesson[]; toDeleteIds: string[] } {
  const plannedKeys = new Set(input.planned.map((l) => lessonKey(l.startsAt, l.ruleId)));
  const taken = new Set<number>();
  const toDeleteIds: string[] = [];
  for (const lesson of input.existing) {
    if (lesson.originalStartsAt) taken.add(lesson.originalStartsAt.getTime());
    const matches = plannedKeys.has(lessonKey(lesson.startsAt, lesson.scheduleRuleId));
    if (isReplaceable(lesson, input.now) && !matches) toDeleteIds.push(lesson.id);
    else taken.add(lesson.startsAt.getTime());
  }

  const toCreate: PlannedLesson[] = [];
  for (const lesson of input.planned) {
    const start = lesson.startsAt.getTime();
    // A lesson that has already begun is history; the generator only fills the future.
    if (start <= input.now.getTime() || taken.has(start)) continue;
    taken.add(start);
    toCreate.push(lesson);
  }
  return { toCreate, toDeleteIds };
}

const endOf = (lesson: TimedLesson): number =>
  lesson.startsAt.getTime() + lesson.durationMin * 60_000;

/** Pairs of lessons that overlap in time; lessons that only touch at a boundary do not. */
export function findConflicts<M extends TimedLesson, O extends TimedLesson>(
  mine: M[],
  others: O[],
): { mine: M; other: O }[] {
  const conflicts: { mine: M; other: O }[] = [];
  for (const lesson of mine) {
    for (const other of others) {
      if (lesson.startsAt.getTime() < endOf(other) && other.startsAt.getTime() < endOf(lesson)) {
        conflicts.push({ mine: lesson, other });
      }
    }
  }
  return conflicts;
}
