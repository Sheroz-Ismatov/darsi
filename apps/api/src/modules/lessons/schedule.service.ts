import { Injectable, Logger } from '@nestjs/common';
import {
  addDays,
  diffLessons,
  findConflicts,
  LESSON_DURATION_MAX,
  LESSON_HORIZON_DAYS,
  planLessons,
  todayIn,
  zonedDateTimeToUtc,
  type LessonConflictDto,
  type PutScheduleRulesRequest,
  type PutScheduleRulesResponse,
  type ScheduleRuleDto,
} from '@darsi/shared';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { fromDateString, toDateString } from '../courses/snapshot-diff';

const groupNotFound = () => new AppError('GROUP_NOT_FOUND', 'Group not found', 404);

/** A sync makes a handful of round trips to a remote database; the default 5 s is too tight. */
const TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 };
const CONFLICTS_MAX = 20;

type Db = Prisma.TransactionClient;

export interface SyncResult {
  created: number;
  deleted: number;
}

/** Dates and instants of the generation window: today and 8 weeks ahead in the school's zone. */
const horizon = (timeZone: string, now: Date) => {
  const from = todayIn(timeZone, now);
  const to = addDays(from, LESSON_HORIZON_DAYS);
  return {
    from,
    to,
    fromInstant: zonedDateTimeToUtc(from, '00:00', timeZone),
    toInstant: zonedDateTimeToUtc(addDays(to, 1), '00:00', timeZone),
  };
};

const ruleKey = (rule: { weekday: number; startTime: string; durationMin: number }): string =>
  `${rule.weekday}|${rule.startTime}|${rule.durationMin}`;

const byDayAndTime = (a: ScheduleRuleDto, b: ScheduleRuleDto): number =>
  a.weekday - b.weekday || a.startTime.localeCompare(b.startTime);

/** Rules still in force: open, or closed no earlier than today. */
const activeRulesWhere = (groupId: string, today: string): Prisma.ScheduleRuleWhereInput => ({
  groupId,
  OR: [{ validTo: null }, { validTo: { gte: fromDateString(today)! } }],
});

const toRuleDto = (row: {
  id: string;
  weekday: number;
  startTime: string;
  durationMin: number;
  validFrom: Date;
}): ScheduleRuleDto => ({
  id: row.id,
  weekday: row.weekday,
  startTime: row.startTime,
  durationMin: row.durationMin,
  validFrom: toDateString(row.validFrom)!,
});

/**
 * Schedule rules of groups and the lessons they produce (TZ FR-13, FR-14). The arithmetic lives
 * in `@darsi/shared` domain functions; this service only reads and writes the database.
 */
@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getRules(schoolId: string, groupId: string, now = new Date()): Promise<ScheduleRuleDto[]> {
    const group = await this.findGroup(schoolId, groupId);
    const rows = await this.prisma.scheduleRule.findMany({
      where: activeRulesWhere(groupId, todayIn(group.school.timezone, now)),
    });
    return rows.map(toRuleDto).sort(byDayAndTime);
  }

  /**
   * Replaces the group's rule set. Rules equal by day, time and duration stay the same rows; a
   * dropped rule is closed as of yesterday, or deleted when no lesson refers to it any more
   * (T-16, decision 5).
   */
  async replaceRules(
    schoolId: string,
    groupId: string,
    input: PutScheduleRulesRequest,
    actorId: string,
    now = new Date(),
  ): Promise<PutScheduleRulesResponse> {
    const group = await this.findGroup(schoolId, groupId);
    const today = todayIn(group.school.timezone, now);

    const sync = await this.prisma.$transaction(async (tx) => {
      const current = await tx.scheduleRule.findMany({
        where: activeRulesWhere(groupId, today),
        orderBy: { createdAt: 'asc' },
      });
      const wanted = new Set(input.rules.map(ruleKey));
      const kept = new Set<string>();
      const staleIds: string[] = [];
      for (const rule of current) {
        const key = ruleKey(rule);
        if (wanted.has(key) && !kept.has(key)) kept.add(key);
        else staleIds.push(rule.id);
      }
      const added = input.rules.filter((rule) => !kept.has(ruleKey(rule)));

      if (staleIds.length > 0) {
        await tx.scheduleRule.updateMany({
          where: { id: { in: staleIds } },
          data: { validTo: fromDateString(addDays(today, -1)) },
        });
      }
      if (added.length > 0) {
        await tx.scheduleRule.createMany({
          data: added.map((rule) => ({
            schoolId,
            groupId,
            weekday: rule.weekday,
            startTime: rule.startTime,
            durationMin: rule.durationMin,
            validFrom: fromDateString(today)!,
          })),
        });
      }

      const result = await this.syncWith(tx, groupId, now);
      if (staleIds.length > 0) {
        // Only now: the sync has just removed the future lessons of the dropped rules.
        await tx.scheduleRule.deleteMany({
          where: { id: { in: staleIds }, lessons: { none: {} } },
        });
      }
      if (staleIds.length > 0 || added.length > 0) {
        const describe = (rules: { weekday: number; startTime: string; durationMin: number }[]) =>
          rules.map(({ weekday, startTime, durationMin }) => ({ weekday, startTime, durationMin }));
        await tx.auditLog.create({
          data: {
            schoolId,
            actorUserId: actorId,
            entity: 'Group',
            entityId: groupId,
            action: 'schedule_update',
            before: { rules: describe(current) },
            after: { rules: describe(input.rules), ...result },
          },
        });
      }
      return result;
    }, TX_OPTIONS);

    const [rules, conflicts] = await Promise.all([
      this.getRules(schoolId, groupId, now),
      this.conflicts(schoolId, groupId, now),
    ]);
    return { rules, ...sync, conflicts };
  }

  /**
   * Brings the group's lessons on the horizon in line with its rules. An archived group or
   * course, or a blocked school, keeps no replaceable future lessons and gets no new ones.
   */
  syncGroup(groupId: string, now = new Date()): Promise<SyncResult> {
    return this.prisma.$transaction((tx) => this.syncWith(tx, groupId, now), TX_OPTIONS);
  }

  /**
   * Daily job: moves the horizon of every active group one day further. This is a platform-wide
   * system job, so it reads groups across schools; each group still syncs on its own.
   */
  async extendHorizon(
    now = new Date(),
  ): Promise<{ groups: number; created: number; deleted: number; failed: number }> {
    const groups = await this.prisma.group.findMany({
      // A group that never had rules has nothing to generate or drop.
      where: { archivedAt: null, school: { status: 'active' }, scheduleRules: { some: {} } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    const total = { groups: groups.length, created: 0, deleted: 0, failed: 0 };
    for (const group of groups) {
      try {
        const result = await this.syncGroup(group.id, now);
        total.created += result.created;
        total.deleted += result.deleted;
      } catch (error) {
        total.failed += 1;
        // Lesson rows hold no personal data, so the error text is safe to log.
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error(`Lesson horizon sync failed for group ${group.id}: ${reason}`);
      }
    }
    this.logger.log(
      `Lesson horizon extended: ${total.groups} groups, +${total.created} −${total.deleted}, ${total.failed} failed`,
    );
    return total;
  }

  /**
   * Rules keep their wall-clock time when the school's time zone changes, so every generated
   * future lesson moves to the new instant.
   */
  async syncSchool(schoolId: string, now = new Date()): Promise<SyncResult> {
    const groups = await this.prisma.group.findMany({
      where: { schoolId, scheduleRules: { some: {} } },
      select: { id: true },
    });
    const total = { created: 0, deleted: 0 };
    for (const group of groups) {
      const result = await this.syncGroup(group.id, now);
      total.created += result.created;
      total.deleted += result.deleted;
    }
    return total;
  }

  /**
   * After the group's teacher changes, future generated lessons go to the new one. A lesson
   * given to a substitute (T-17) keeps the substitute.
   */
  async reassignTeacher(
    groupId: string,
    previousTeacherId: string,
    teacherMembershipId: string,
    now = new Date(),
  ) {
    await this.prisma.lesson.updateMany({
      where: {
        groupId,
        teacherMembershipId: previousTeacherId,
        scheduleRuleId: { not: null },
        status: 'planned',
        startsAt: { gt: now },
      },
      data: { teacherMembershipId },
    });
  }

  /** Planned lessons of the group's teachers in other groups that overlap the group's own. */
  async conflicts(
    schoolId: string,
    groupId: string,
    now = new Date(),
  ): Promise<LessonConflictDto[]> {
    const group = await this.findGroup(schoolId, groupId);
    const { toInstant } = horizon(group.school.timezone, now);
    const mine = await this.prisma.lesson.findMany({
      where: { schoolId, groupId, status: 'planned', startsAt: { gt: now, lt: toInstant } },
      select: { startsAt: true, durationMin: true, teacherMembershipId: true },
      orderBy: { startsAt: 'asc' },
    });
    if (mine.length === 0) return [];
    const others = await this.prisma.lesson.findMany({
      where: {
        schoolId,
        groupId: { not: groupId },
        status: 'planned',
        teacherMembershipId: { in: [...new Set(mine.map((l) => l.teacherMembershipId))] },
        // A lesson that started up to the longest duration ago can still overlap.
        startsAt: { gt: new Date(now.getTime() - LESSON_DURATION_MAX * 60_000), lt: toInstant },
      },
      select: {
        startsAt: true,
        durationMin: true,
        teacherMembershipId: true,
        group: { select: { name: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
    return findConflicts(mine, others)
      .filter((pair) => pair.mine.teacherMembershipId === pair.other.teacherMembershipId)
      .slice(0, CONFLICTS_MAX)
      .map(({ mine: lesson, other }) => ({
        startsAt: lesson.startsAt.toISOString(),
        durationMin: lesson.durationMin,
        otherGroupName: other.group.name,
        otherStartsAt: other.startsAt.toISOString(),
        otherDurationMin: other.durationMin,
      }));
  }

  private async syncWith(tx: Db, groupId: string, now: Date): Promise<SyncResult> {
    const group = await tx.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        schoolId: true,
        teacherMembershipId: true,
        startsOn: true,
        endsOn: true,
        archivedAt: true,
        course: { select: { archivedAt: true } },
        school: { select: { timezone: true, status: true } },
        scheduleRules: true,
      },
    });
    if (!group) throw groupNotFound();
    const timeZone = group.school.timezone;
    const active =
      group.archivedAt === null &&
      group.course.archivedAt === null &&
      group.school.status === 'active';
    const window = horizon(timeZone, now);

    const planned = active
      ? planLessons({
          rules: group.scheduleRules.map((rule) => ({
            id: rule.id,
            weekday: rule.weekday,
            startTime: rule.startTime,
            durationMin: rule.durationMin,
            validFrom: toDateString(rule.validFrom)!,
            validTo: toDateString(rule.validTo),
          })),
          from: window.from,
          to: window.to,
          timeZone,
          groupStartsOn: toDateString(group.startsOn),
          groupEndsOn: toDateString(group.endsOn),
        })
      : [];
    const existing = await tx.lesson.findMany({
      where: {
        groupId,
        OR: [
          // An inactive group drops every replaceable future lesson, beyond the horizon too.
          { startsAt: { gte: window.fromInstant, ...(active && { lt: window.toInstant }) } },
          { originalStartsAt: { gte: window.fromInstant } },
        ],
      },
      select: {
        id: true,
        startsAt: true,
        originalStartsAt: true,
        status: true,
        scheduleRuleId: true,
      },
    });

    const { toCreate, toDeleteIds } = diffLessons({
      planned,
      // TODO(T-22): read attendance marks; until then no lesson has any.
      existing: existing.map((lesson) => ({ ...lesson, hasAttendance: false })),
      now,
    });
    if (toDeleteIds.length > 0) {
      await tx.lesson.deleteMany({ where: { id: { in: toDeleteIds }, groupId } });
    }
    const created =
      toCreate.length > 0
        ? await tx.lesson.createMany({
            data: toCreate.map((lesson) => ({
              schoolId: group.schoolId,
              groupId,
              teacherMembershipId: group.teacherMembershipId,
              startsAt: lesson.startsAt,
              durationMin: lesson.durationMin,
              scheduleRuleId: lesson.ruleId,
            })),
            // A concurrent sync may have created the same slot; the unique index keeps one.
            skipDuplicates: true,
          })
        : { count: 0 };
    return { created: created.count, deleted: toDeleteIds.length };
  }

  private async findGroup(schoolId: string, groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, schoolId },
      select: { id: true, school: { select: { timezone: true } } },
    });
    if (!group) throw groupNotFound();
    return group;
  }
}
