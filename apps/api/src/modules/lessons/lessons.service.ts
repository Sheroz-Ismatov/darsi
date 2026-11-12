import { Injectable } from '@nestjs/common';
import {
  addDays,
  findConflicts,
  LESSON_DURATION_MAX,
  zonedDateTimeToUtc,
  type CancelLessonRequest,
  type CourseIcon,
  type CreateLessonRequest,
  type LessonChangeResponse,
  type LessonConflictDto,
  type LessonDetailDto,
  type LessonDto,
  type ListLessonsQuery,
  type RescheduleLessonRequest,
  type UpdateLessonRequest,
} from '@darsi/shared';
import { Prisma } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { assertTeacher, countEnrolled } from '../courses/group-checks';

const lessonInclude = {
  group: {
    select: {
      name: true,
      meetingUrl: true,
      capacity: true,
      course: { select: { id: true, name: true, color: true, icon: true } },
    },
  },
  teacher: { select: { id: true, displayName: true } },
} satisfies Prisma.LessonInclude;

type LessonRow = Prisma.LessonGetPayload<{ include: typeof lessonInclude }>;
type Db = Prisma.TransactionClient;

/** A few round trips to a remote database; the default 5 s is too tight. */
const TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 };
const CONFLICTS_MAX = 20;
const MINUTE_MS = 60_000;

const lessonNotFound = () => new AppError('LESSON_NOT_FOUND', 'Lesson not found', 404);
const groupNotFound = () => new AppError('GROUP_NOT_FOUND', 'Group not found', 404);
const notPlanned = () =>
  new AppError('LESSON_NOT_PLANNED', 'Only a planned lesson can be changed', 409);
const slotTaken = () =>
  new AppError('LESSON_SLOT_TAKEN', 'The group already has a lesson at this time', 409);

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/** Turns the group's unique slot index into a 409 instead of a 500. */
async function guardSlot<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (isUniqueViolation(error)) throw slotTaken();
    throw error;
  }
}

/** What an audit record keeps of a lesson. */
const snapshot = (row: {
  groupId: string;
  teacherMembershipId: string;
  startsAt: Date;
  durationMin: number;
  status: string;
  meetingUrl: string | null;
}) => ({
  groupId: row.groupId,
  teacherMembershipId: row.teacherMembershipId,
  startsAt: row.startsAt.toISOString(),
  durationMin: row.durationMin,
  status: row.status,
  meetingUrl: row.meetingUrl,
});

/**
 * The school's calendar (TZ FR-15, FR-16): reading lessons and changing single ones. Weekly
 * rules and generation live in ScheduleService.
 */
@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lessons whose start falls on the dates `from…to` of the school's calendar. One query with
   * its includes, whatever the number of lessons (T-17, decision 7).
   */
  async list(schoolId: string, query: ListLessonsQuery): Promise<LessonDto[]> {
    const timeZone = await this.timeZoneOf(schoolId);
    const rows = await this.prisma.lesson.findMany({
      where: {
        schoolId,
        ...(query.groupId && { groupId: query.groupId }),
        ...(query.teacherId && { teacherMembershipId: query.teacherId }),
        ...(query.courseId && { group: { courseId: query.courseId } }),
        startsAt: {
          gte: zonedDateTimeToUtc(query.from, '00:00', timeZone),
          lt: zonedDateTimeToUtc(addDays(query.to, 1), '00:00', timeZone),
        },
      },
      include: lessonInclude,
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toLessonDto);
  }

  async get(schoolId: string, id: string): Promise<LessonDetailDto> {
    return this.present(await this.find(this.prisma, schoolId, id));
  }

  /** A one-off lesson: no schedule rule, so the generator never removes it. */
  async create(
    schoolId: string,
    input: CreateLessonRequest,
    actorId: string,
  ): Promise<LessonChangeResponse> {
    const group = await this.prisma.group.findFirst({
      where: { id: input.groupId, schoolId },
      select: {
        teacherMembershipId: true,
        archivedAt: true,
        course: { select: { archivedAt: true } },
        school: { select: { timezone: true } },
      },
    });
    if (!group) throw groupNotFound();
    if (group.archivedAt) throw new AppError('GROUP_ARCHIVED', 'The group is archived', 409);
    if (group.course.archivedAt) {
      throw new AppError('COURSE_ARCHIVED', 'The course is archived', 409);
    }
    const teacherMembershipId = input.teacherMembershipId ?? group.teacherMembershipId;
    if (input.teacherMembershipId) {
      await assertTeacher(this.prisma, schoolId, input.teacherMembershipId);
    }

    const created = await guardSlot(() =>
      this.prisma.$transaction(async (tx) => {
        const lesson = await tx.lesson.create({
          data: {
            schoolId,
            groupId: input.groupId,
            teacherMembershipId,
            startsAt: zonedDateTimeToUtc(input.date, input.time, group.school.timezone),
            durationMin: input.durationMin,
            meetingUrl: input.meetingUrl ?? null,
          },
          include: lessonInclude,
        });
        await this.audit(tx, schoolId, actorId, lesson.id, 'create', null, snapshot(lesson));
        return lesson;
      }, TX_OPTIONS),
    );
    return this.withConflicts(created);
  }

  /** There is no way back: a lesson cancelled by mistake is replaced by a one-off (decision 2). */
  async cancel(
    schoolId: string,
    id: string,
    input: CancelLessonRequest,
    actorId: string,
  ): Promise<LessonDetailDto> {
    const lesson = await this.prisma.$transaction(async (tx) => {
      // The status condition makes a concurrent second cancel fail instead of overwriting.
      const { count } = await tx.lesson.updateMany({
        where: { id, schoolId, status: 'planned' },
        data: { status: 'cancelled', cancelReason: input.reason },
      });
      if (count === 0) {
        await this.find(tx, schoolId, id);
        throw notPlanned();
      }
      await this.audit(
        tx,
        schoolId,
        actorId,
        id,
        'cancel',
        { status: 'planned' },
        { status: 'cancelled', cancelReason: input.reason },
      );
      return this.find(tx, schoolId, id);
    }, TX_OPTIONS);
    return this.present(lesson);
  }

  /**
   * Moves the lesson. `originalStartsAt` keeps the very first time, so the generator never puts a
   * lesson back into the slot it left (decision 3).
   */
  async reschedule(
    schoolId: string,
    id: string,
    input: RescheduleLessonRequest,
    actorId: string,
  ): Promise<LessonChangeResponse> {
    const before = await this.find(this.prisma, schoolId, id);
    if (before.status !== 'planned') throw notPlanned();
    const timeZone = await this.timeZoneOf(schoolId);
    const startsAt = zonedDateTimeToUtc(input.date, input.time, timeZone);
    const durationMin = input.durationMin ?? before.durationMin;
    if (startsAt.getTime() === before.startsAt.getTime() && durationMin === before.durationMin) {
      return this.withConflicts(before);
    }
    const originalStartsAt = before.originalStartsAt ?? before.startsAt;

    const after = await guardSlot(() =>
      this.prisma.$transaction(async (tx) => {
        const { count } = await tx.lesson.updateMany({
          where: { id, schoolId, status: 'planned' },
          data: { startsAt, durationMin, originalStartsAt },
        });
        if (count === 0) throw notPlanned();
        await this.audit(
          tx,
          schoolId,
          actorId,
          id,
          'reschedule',
          { startsAt: before.startsAt.toISOString(), durationMin: before.durationMin },
          {
            startsAt: startsAt.toISOString(),
            durationMin,
            originalStartsAt: originalStartsAt.toISOString(),
          },
        );
        return this.find(tx, schoolId, id);
      }, TX_OPTIONS),
    );
    return this.withConflicts(after);
  }

  /** The call link and a substitute teacher for this one lesson; the group stays as it is. */
  async update(
    schoolId: string,
    id: string,
    input: UpdateLessonRequest,
    actorId: string,
  ): Promise<LessonChangeResponse> {
    const before = await this.find(this.prisma, schoolId, id);
    const changesTeacher =
      input.teacherMembershipId !== undefined &&
      input.teacherMembershipId !== before.teacherMembershipId;
    const changesLink = input.meetingUrl !== undefined && input.meetingUrl !== before.meetingUrl;
    if (!changesTeacher && !changesLink)
      return { lesson: await this.present(before), conflicts: [] };
    if (changesTeacher) {
      // A given lesson keeps the teacher who gave it: attendance marks are theirs.
      if (before.status !== 'planned') throw notPlanned();
      await assertTeacher(this.prisma, schoolId, input.teacherMembershipId!);
    }
    const data = {
      ...(changesTeacher && { teacherMembershipId: input.teacherMembershipId! }),
      ...(changesLink && { meetingUrl: input.meetingUrl! }),
    };

    const after = await this.prisma.$transaction(async (tx) => {
      const lesson = await tx.lesson.update({ where: { id }, data, include: lessonInclude });
      await this.audit(
        tx,
        schoolId,
        actorId,
        id,
        'update',
        {
          ...(changesTeacher && { teacherMembershipId: before.teacherMembershipId }),
          ...(changesLink && { meetingUrl: before.meetingUrl }),
        },
        data,
      );
      return lesson;
    }, TX_OPTIONS);
    if (!changesTeacher) return { lesson: await this.present(after), conflicts: [] };
    return this.withConflicts(after);
  }

  /** Other planned lessons of the same teacher that overlap this one (decision 4). */
  private async conflictsOf(lesson: LessonRow): Promise<LessonConflictDto[]> {
    if (lesson.status !== 'planned') return [];
    const end = lesson.startsAt.getTime() + lesson.durationMin * MINUTE_MS;
    const others = await this.prisma.lesson.findMany({
      where: {
        schoolId: lesson.schoolId,
        id: { not: lesson.id },
        teacherMembershipId: lesson.teacherMembershipId,
        status: 'planned',
        // A lesson that started up to the longest duration earlier can still overlap.
        startsAt: {
          gt: new Date(lesson.startsAt.getTime() - LESSON_DURATION_MAX * MINUTE_MS),
          lt: new Date(end),
        },
      },
      select: { startsAt: true, durationMin: true, group: { select: { name: true } } },
      orderBy: { startsAt: 'asc' },
    });
    return findConflicts([lesson], others)
      .slice(0, CONFLICTS_MAX)
      .map(({ other }) => ({
        startsAt: lesson.startsAt.toISOString(),
        durationMin: lesson.durationMin,
        otherGroupName: other.group.name,
        otherStartsAt: other.startsAt.toISOString(),
        otherDurationMin: other.durationMin,
      }));
  }

  private async withConflicts(row: LessonRow): Promise<LessonChangeResponse> {
    const [lesson, conflicts] = await Promise.all([this.present(row), this.conflictsOf(row)]);
    return { lesson, conflicts };
  }

  private async present(row: LessonRow): Promise<LessonDetailDto> {
    const enrolled = await countEnrolled(this.prisma, [row.groupId]);
    return {
      ...toLessonDto(row),
      group: { capacity: row.group.capacity, enrolledCount: enrolled.get(row.groupId) ?? 0 },
    };
  }

  private async find(db: Db, schoolId: string, id: string): Promise<LessonRow> {
    const lesson = await db.lesson.findFirst({ where: { id, schoolId }, include: lessonInclude });
    if (!lesson) throw lessonNotFound();
    return lesson;
  }

  private async timeZoneOf(schoolId: string): Promise<string> {
    const school = await this.prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      select: { timezone: true },
    });
    return school.timezone;
  }

  private async audit(
    tx: Db,
    schoolId: string,
    actorUserId: string,
    entityId: string,
    action: string,
    before: Prisma.InputJsonObject | null,
    after: Prisma.InputJsonObject,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        schoolId,
        actorUserId,
        entity: 'Lesson',
        entityId,
        action,
        before: before ?? undefined,
        after,
      },
    });
  }
}

export const toLessonDto = (row: LessonRow): LessonDto => ({
  id: row.id,
  groupId: row.groupId,
  groupName: row.group.name,
  course: {
    id: row.group.course.id,
    name: row.group.course.name,
    color: row.group.course.color,
    icon: row.group.course.icon as CourseIcon,
  },
  teacher: { id: row.teacher.id, displayName: row.teacher.displayName },
  startsAt: row.startsAt.toISOString(),
  durationMin: row.durationMin,
  status: row.status,
  originalStartsAt: row.originalStartsAt?.toISOString() ?? null,
  cancelReason: row.cancelReason,
  meetingUrl: row.meetingUrl ?? row.group.meetingUrl,
  isOneOff: row.scheduleRuleId === null,
});
