import { Injectable } from '@nestjs/common';
import type {
  CourseDto,
  CourseGroupSummaryDto,
  CourseIcon,
  CreateCourseRequest,
  ListCoursesQuery,
  UpdateCourseRequest,
} from '@darsi/shared';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ScheduleService } from '../lessons/schedule.service';
import { courseNotFound, GroupsService } from './groups.service';
import { snapshotDiff } from './snapshot-diff';

const courseInclude = {
  groups: {
    select: {
      id: true,
      name: true,
      capacity: true,
      archivedAt: true,
      teacher: { select: { displayName: true } },
    },
  },
} satisfies Prisma.CourseInclude;

type CourseRow = Prisma.CourseGetPayload<{ include: typeof courseInclude }>;

/** What an audit record keeps of a course. */
const snapshot = (row: CourseRow) => ({
  name: row.name,
  description: row.description,
  format: row.format,
  kind: row.kind,
  ageFrom: row.ageFrom,
  ageTo: row.ageTo,
  showInCatalog: row.showInCatalog,
  color: row.color,
  icon: row.icon,
});

const byActiveThenName = (a: CourseGroupSummaryDto, b: CourseGroupSummaryDto): number =>
  Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, 'ru');

/**
 * The school's course catalog (TZ FR-11). A course is deleted only while it has no groups at
 * all; otherwise it is archived, and archiving leaves its groups as they are (T-15, decisions 1–2).
 */
@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groups: GroupsService,
    private readonly schedule: ScheduleService,
  ) {}

  async list(schoolId: string, query: ListCoursesQuery): Promise<CourseDto[]> {
    const rows = await this.prisma.course.findMany({
      where: { schoolId, archivedAt: query.archived ? { not: null } : null },
      include: courseInclude,
    });
    const enrolled = await this.groups.countEnrolled(
      rows.flatMap((row) => row.groups.map((group) => group.id)),
    );
    return rows
      .map((row) => this.toDto(row, enrolled))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  async create(schoolId: string, data: CreateCourseRequest, actorId: string): Promise<CourseDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          schoolId,
          name: data.name,
          description: data.description ?? null,
          format: data.format,
          kind: data.kind,
          ageFrom: data.ageFrom ?? null,
          ageTo: data.ageTo ?? null,
          showInCatalog: data.showInCatalog,
          color: data.color,
          icon: data.icon,
        },
        include: courseInclude,
      });
      await this.audit(tx, schoolId, actorId, course.id, 'create', null, snapshot(course));
      return course;
    });
    return this.present(created);
  }

  async update(
    schoolId: string,
    id: string,
    data: UpdateCourseRequest,
    actorId: string,
  ): Promise<CourseDto> {
    const before = await this.find(schoolId, id);
    const current = snapshot(before);
    const next = { ...current };
    for (const key of Object.keys(data) as (keyof UpdateCourseRequest)[]) {
      const value = data[key];
      if (value !== undefined) Object.assign(next, { [key]: value });
    }
    if (next.ageFrom !== null && next.ageTo !== null && next.ageFrom > next.ageTo) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', 400, {
        issues: [{ path: 'ageTo', message: 'ageFrom must not exceed ageTo' }],
      });
    }

    const diff = snapshotDiff(current, next);
    if (diff.fields.length === 0) return this.present(before);
    // Group capacities follow the kind, so it is fixed once the course has any group.
    if (diff.fields.includes('kind') && before.groups.length > 0) {
      throw new AppError('COURSE_KIND_LOCKED', 'The course already has groups', 409);
    }

    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.course.update({
        where: { id },
        data: next,
        include: courseInclude,
      });
      await this.audit(tx, schoolId, actorId, id, 'update', diff.before, diff.after);
      return updated;
    });
    return this.present(after);
  }

  async setArchived(
    schoolId: string,
    id: string,
    archived: boolean,
    actorId: string,
  ): Promise<CourseDto> {
    const before = await this.find(schoolId, id);
    if (Boolean(before.archivedAt) === archived) return this.present(before);
    const archivedAt = archived ? new Date() : null;
    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.course.update({
        where: { id },
        data: { archivedAt },
        include: courseInclude,
      });
      await this.audit(
        tx,
        schoolId,
        actorId,
        id,
        archived ? 'archive' : 'unarchive',
        { archivedAt: before.archivedAt?.toISOString() ?? null },
        { archivedAt: archivedAt?.toISOString() ?? null },
      );
      return updated;
    });
    // Lessons of an archived course stop being generated, like those of an archived group.
    for (const group of after.groups) {
      await this.schedule.syncGroup(group.id);
    }
    return this.present(after);
  }

  async remove(schoolId: string, id: string, actorId: string): Promise<void> {
    const before = await this.find(schoolId, id);
    if (before.groups.length > 0) {
      throw new AppError('COURSE_HAS_GROUPS', 'A course with groups can only be archived', 409);
    }
    await this.prisma.$transaction(async (tx) => {
      // The foreign key restricts the delete if a group appeared after the check above.
      await tx.course.delete({ where: { id } });
      await this.audit(tx, schoolId, actorId, id, 'delete', snapshot(before), {});
    });
  }

  private async find(schoolId: string, id: string): Promise<CourseRow> {
    const course = await this.prisma.course.findFirst({
      where: { id, schoolId },
      include: courseInclude,
    });
    if (!course) throw courseNotFound();
    return course;
  }

  private async present(row: CourseRow): Promise<CourseDto> {
    const enrolled = await this.groups.countEnrolled(row.groups.map((group) => group.id));
    return this.toDto(row, enrolled);
  }

  private toDto(row: CourseRow, enrolled: Map<string, number>): CourseDto {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      format: row.format,
      kind: row.kind,
      ageFrom: row.ageFrom,
      ageTo: row.ageTo,
      showInCatalog: row.showInCatalog,
      color: row.color,
      icon: row.icon as CourseIcon,
      archived: row.archivedAt !== null,
      createdAt: row.createdAt.toISOString(),
      groups: row.groups
        .map((group) => {
          const enrolledCount = enrolled.get(group.id) ?? 0;
          return {
            id: group.id,
            name: group.name,
            teacherName: group.teacher.displayName,
            capacity: group.capacity,
            enrolledCount,
            freeSeats: group.capacity - enrolledCount,
            archived: group.archivedAt !== null,
          };
        })
        .sort(byActiveThenName),
    };
  }

  private async audit(
    tx: Prisma.TransactionClient,
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
        entity: 'Course',
        entityId,
        action,
        before: before ?? undefined,
        after,
      },
    });
  }
}
