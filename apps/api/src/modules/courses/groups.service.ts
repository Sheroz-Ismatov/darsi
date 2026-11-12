import { Injectable } from '@nestjs/common';
import type {
  CourseIcon,
  CreateGroupRequest,
  GroupDto,
  ListGroupsQuery,
  UpdateGroupRequest,
} from '@darsi/shared';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ScheduleService } from '../lessons/schedule.service';
import { assertTeacher, countEnrolled } from './group-checks';
import { fromDateString, snapshotDiff, toDateString } from './snapshot-diff';

export const courseNotFound = () => new AppError('COURSE_NOT_FOUND', 'Course not found', 404);
const groupNotFound = () => new AppError('GROUP_NOT_FOUND', 'Group not found', 404);

const groupInclude = {
  course: {
    select: {
      id: true,
      name: true,
      color: true,
      icon: true,
      kind: true,
      format: true,
      archivedAt: true,
    },
  },
  teacher: { select: { id: true, displayName: true } },
} satisfies Prisma.GroupInclude;

type GroupRow = Prisma.GroupGetPayload<{ include: typeof groupInclude }>;

/** What an audit record keeps of a group. */
const snapshot = (row: {
  name: string;
  teacherMembershipId: string;
  capacity: number;
  meetingUrl: string | null;
  startsOn: Date | null;
  endsOn: Date | null;
}) => ({
  name: row.name,
  teacherMembershipId: row.teacherMembershipId,
  capacity: row.capacity,
  meetingUrl: row.meetingUrl,
  startsOn: toDateString(row.startsOn),
  endsOn: toDateString(row.endsOn),
});

const byActiveThenName = (a: GroupDto, b: GroupDto): number =>
  Number(a.archived) - Number(b.archived) ||
  a.course.name.localeCompare(b.course.name, 'ru') ||
  a.name.localeCompare(b.name, 'ru');

/** Groups of the school's courses (TZ FR-12). Groups are never deleted, only archived. */
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedule: ScheduleService,
  ) {}

  countEnrolled(groupIds: string[]): Promise<Map<string, number>> {
    return countEnrolled(this.prisma, groupIds);
  }

  async list(schoolId: string, query: ListGroupsQuery): Promise<GroupDto[]> {
    const rows = await this.prisma.group.findMany({
      where: { schoolId, ...(query.courseId && { courseId: query.courseId }) },
      include: groupInclude,
    });
    const enrolled = await this.countEnrolled(rows.map((row) => row.id));
    return rows.map((row) => this.toDto(row, enrolled.get(row.id) ?? 0)).sort(byActiveThenName);
  }

  async get(schoolId: string, id: string): Promise<GroupDto> {
    return this.present(await this.find(schoolId, id));
  }

  async create(schoolId: string, data: CreateGroupRequest, actorId: string): Promise<GroupDto> {
    const course = await this.prisma.course.findFirst({
      where: { id: data.courseId, schoolId },
      select: { id: true, kind: true, archivedAt: true },
    });
    if (!course) throw courseNotFound();
    if (course.archivedAt) {
      throw new AppError('COURSE_ARCHIVED', 'The course is archived', 409);
    }
    await this.assertTeacher(schoolId, data.teacherMembershipId);
    const branch = await this.prisma.branch.findFirst({
      where: { schoolId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!branch) throw new AppError('BRANCH_NOT_FOUND', 'The school has no branch', 409);

    const created = await this.prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          schoolId,
          branchId: branch.id,
          courseId: course.id,
          name: data.name,
          teacherMembershipId: data.teacherMembershipId,
          // An individual course teaches one student per group, whatever the form sent.
          capacity: course.kind === 'individual' ? 1 : data.capacity,
          meetingUrl: data.meetingUrl ?? null,
          startsOn: fromDateString(data.startsOn ?? null),
          endsOn: fromDateString(data.endsOn ?? null),
        },
        include: groupInclude,
      });
      await this.audit(tx, schoolId, actorId, group.id, 'create', null, {
        courseId: group.courseId,
        ...snapshot(group),
      });
      return group;
    });
    return this.present(created);
  }

  async update(
    schoolId: string,
    id: string,
    data: UpdateGroupRequest,
    actorId: string,
  ): Promise<GroupDto> {
    const before = await this.find(schoolId, id);
    const current = snapshot(before);
    const next = {
      name: data.name ?? current.name,
      teacherMembershipId: data.teacherMembershipId ?? current.teacherMembershipId,
      capacity: before.course.kind === 'individual' ? 1 : (data.capacity ?? current.capacity),
      meetingUrl: data.meetingUrl !== undefined ? data.meetingUrl : current.meetingUrl,
      startsOn: data.startsOn !== undefined ? data.startsOn : current.startsOn,
      endsOn: data.endsOn !== undefined ? data.endsOn : current.endsOn,
    };
    if (next.startsOn && next.endsOn && next.startsOn > next.endsOn) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', 400, {
        issues: [{ path: 'endsOn', message: 'endsOn must not precede startsOn' }],
      });
    }

    const diff = snapshotDiff(current, next);
    if (diff.fields.length === 0) return this.present(before);
    // A teacher who has since left may stay on the group; only a new choice is checked.
    if (diff.fields.includes('teacherMembershipId')) {
      await this.assertTeacher(schoolId, next.teacherMembershipId);
    }

    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.group.update({
        where: { id },
        data: {
          name: next.name,
          teacherMembershipId: next.teacherMembershipId,
          capacity: next.capacity,
          meetingUrl: next.meetingUrl,
          startsOn: fromDateString(next.startsOn),
          endsOn: fromDateString(next.endsOn),
        },
        include: groupInclude,
      });
      await this.audit(tx, schoolId, actorId, id, 'update', diff.before, diff.after);
      return updated;
    });
    if (diff.fields.includes('teacherMembershipId')) {
      await this.schedule.reassignTeacher(
        id,
        current.teacherMembershipId,
        next.teacherMembershipId,
      );
    }
    if (diff.fields.includes('startsOn') || diff.fields.includes('endsOn')) {
      await this.schedule.syncGroup(id);
    }
    return this.present(after);
  }

  /** An archived group stays in history; it can come back even while its course is archived. */
  async setArchived(
    schoolId: string,
    id: string,
    archived: boolean,
    actorId: string,
  ): Promise<GroupDto> {
    const before = await this.find(schoolId, id);
    if (Boolean(before.archivedAt) === archived) return this.present(before);
    const archivedAt = archived ? new Date() : null;
    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.group.update({
        where: { id },
        data: { archivedAt },
        include: groupInclude,
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
    // Archiving drops the future generated lessons; restoring brings them back.
    await this.schedule.syncGroup(id);
    return this.present(after);
  }

  private assertTeacher(schoolId: string, membershipId: string): Promise<void> {
    return assertTeacher(this.prisma, schoolId, membershipId);
  }

  private async find(schoolId: string, id: string): Promise<GroupRow> {
    const group = await this.prisma.group.findFirst({
      where: { id, schoolId },
      include: groupInclude,
    });
    if (!group) throw groupNotFound();
    return group;
  }

  private async present(row: GroupRow): Promise<GroupDto> {
    const enrolled = await this.countEnrolled([row.id]);
    return this.toDto(row, enrolled.get(row.id) ?? 0);
  }

  private toDto(row: GroupRow, enrolledCount: number): GroupDto {
    return {
      id: row.id,
      name: row.name,
      capacity: row.capacity,
      meetingUrl: row.meetingUrl,
      startsOn: toDateString(row.startsOn),
      endsOn: toDateString(row.endsOn),
      archived: row.archivedAt !== null,
      createdAt: row.createdAt.toISOString(),
      course: {
        id: row.course.id,
        name: row.course.name,
        color: row.course.color,
        icon: row.course.icon as CourseIcon,
        kind: row.course.kind,
        format: row.course.format,
        archived: row.course.archivedAt !== null,
      },
      teacher: { id: row.teacher.id, displayName: row.teacher.displayName },
      enrolledCount,
      freeSeats: row.capacity - enrolledCount,
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
        entity: 'Group',
        entityId,
        action,
        before: before ?? undefined,
        after,
      },
    });
  }
}
