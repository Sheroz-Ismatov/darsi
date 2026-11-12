import { z } from 'zod';
import type { CourseColor, CourseIcon } from '../constants';
import { daysBetween } from '../domain/time';

export const LESSON_STATUSES = ['planned', 'done', 'cancelled'] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export const SCHEDULE_RULES_MAX = 14;
export const LESSON_DURATION_MIN = 15;
export const LESSON_DURATION_MAX = 480;
/** How far ahead lessons are generated, in days (TZ FR-13: 8 weeks). */
export const LESSON_HORIZON_DAYS = 56;
/** Longest range `GET /lessons` returns, in days. */
export const LESSONS_RANGE_MAX_DAYS = 62;

/** Wall-clock time `HH:mm`, 00:00–23:59. */
export const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');

// ---------- Schedule rules (TZ FR-13) ----------

export const scheduleRuleInputSchema = z.object({
  /** ISO weekday: 1 — Monday, 7 — Sunday. */
  weekday: z.number().int().min(1).max(7),
  /** In the school's time zone. */
  startTime: timeOfDaySchema,
  durationMin: z.number().int().min(LESSON_DURATION_MIN).max(LESSON_DURATION_MAX),
});
export type ScheduleRuleInput = z.infer<typeof scheduleRuleInputSchema>;

/** PUT /groups/:id/schedule-rules — replaces the whole set. */
export const putScheduleRulesRequestSchema = z.object({
  rules: z
    .array(scheduleRuleInputSchema)
    .max(SCHEDULE_RULES_MAX)
    .superRefine((rules, ctx) => {
      const seen = new Set<string>();
      rules.forEach((rule, index) => {
        const key = `${rule.weekday}|${rule.startTime}`;
        if (seen.has(key)) {
          ctx.addIssue({
            code: 'custom',
            path: [index, 'startTime'],
            message: 'Two lessons at the same day and time',
          });
        }
        seen.add(key);
      });
    }),
});
export type PutScheduleRulesRequest = z.infer<typeof putScheduleRulesRequestSchema>;

export interface ScheduleRuleDto {
  id: string;
  weekday: number;
  startTime: string;
  durationMin: number;
  validFrom: string;
}

/** A lesson of the group that overlaps another planned lesson of the same teacher (TZ FR-14). */
export interface LessonConflictDto {
  startsAt: string;
  durationMin: number;
  otherGroupName: string;
  otherStartsAt: string;
  otherDurationMin: number;
}

export interface PutScheduleRulesResponse {
  rules: ScheduleRuleDto[];
  /** Lessons created and removed by this change. */
  created: number;
  deleted: number;
  /** A warning only: the rules are saved anyway. */
  conflicts: LessonConflictDto[];
}

// ---------- Lessons ----------

/** GET /lessons — dates in the school's time zone, both inclusive. */
export const listLessonsQuerySchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    groupId: z.uuid().optional(),
  })
  .refine((query) => query.from <= query.to, { message: 'to must not precede from', path: ['to'] })
  .refine((query) => daysBetween(query.from, query.to) < LESSONS_RANGE_MAX_DAYS, {
    message: `At most ${LESSONS_RANGE_MAX_DAYS} days`,
    path: ['to'],
  });
export type ListLessonsQuery = z.infer<typeof listLessonsQuerySchema>;

export interface LessonDto {
  id: string;
  groupId: string;
  groupName: string;
  course: { id: string; name: string; color: CourseColor; icon: CourseIcon };
  /** Membership id and name of the teacher. */
  teacher: { id: string; displayName: string };
  /** UTC instant; shown in the school's time zone. */
  startsAt: string;
  durationMin: number;
  status: LessonStatus;
  /** Set when the lesson was moved: its time before the move. */
  originalStartsAt: string | null;
  cancelReason: string | null;
  /** The lesson's own link, otherwise the group's. */
  meetingUrl: string | null;
  /** Created by hand, not by a schedule rule. */
  isOneOff: boolean;
}
