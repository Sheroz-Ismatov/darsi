import { Injectable } from '@nestjs/common';
import {
  PARENT_INVITE_TTL_HOURS,
  SEARCH_PHONE_DIGITS_MIN,
  STUDENTS_PAGE_SIZE,
  type CourseColor,
  type CreateStudentRequest,
  type GuardianInput,
  type InviteLinkResponse,
  type ListStudentsQuery,
  type StudentDetailDto,
  type StudentGuardianChangeResponse,
  type StudentListItemDto,
  type StudentListResponse,
  type UpdateStudentRequest,
} from '@darsi/shared';
import { Prisma, type MembershipStatus } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { fromDateString, snapshotDiff, toDateString } from '../courses/snapshot-diff';
import { InvitesService } from '../invites/invites.service';
import { PlanLimitsService } from '../platform/plan-limits.service';
import {
  enrollmentInclude,
  schoolToday,
  studentNotFound,
  toEnrollmentDto,
  TX_OPTIONS,
} from './student-helpers';

const guardianNotFound = () => new AppError('GUARDIAN_NOT_FOUND', 'Parent not found', 404);

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const listSelect = {
  id: true,
  firstName: true,
  lastName: true,
  birthDate: true,
  createdBy: true,
  archivedAt: true,
} satisfies Prisma.StudentSelect;

type ListRow = Prisma.StudentGetPayload<{ select: typeof listSelect }>;

/** A parent of a listed student, read with one join instead of nested queries. */
interface ListGuardianRow {
  id: string;
  studentId: string;
  membershipId: string;
  name: string;
  phone: string | null;
  status: MembershipStatus;
}

/** A group of an active enrollment of a listed student. */
interface ListGroupRow {
  enrollmentId: string;
  studentId: string;
  id: string;
  name: string;
  courseColor: CourseColor;
}

const groupBy = <T extends { studentId: string }>(rows: T[]): Map<string, T[]> => {
  const map = new Map<string, T[]>();
  for (const row of rows) map.set(row.studentId, [...(map.get(row.studentId) ?? []), row]);
  return map;
};

const detailInclude = (now: Date) =>
  ({
    guardians: {
      orderBy: { createdAt: 'asc' },
      include: {
        membership: {
          select: {
            id: true,
            displayName: true,
            phone: true,
            status: true,
            inviteTokens: {
              where: { usedAt: null, revokedAt: null, expiresAt: { gt: now } },
              select: { expiresAt: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    },
    enrollments: {
      orderBy: [{ status: 'asc' }, { enrolledOn: 'desc' }, { createdAt: 'desc' }],
      include: enrollmentInclude,
    },
  }) satisfies Prisma.StudentInclude;

type DetailRow = Prisma.StudentGetPayload<{ include: ReturnType<typeof detailInclude> }>;

/** What an audit record keeps of a student: no phones, they belong to the parent record. */
const snapshot = (row: {
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  comment: string | null;
}) => ({
  firstName: row.firstName,
  lastName: row.lastName,
  birthDate: toDateString(row.birthDate),
  comment: row.comment,
});

/** Name words match the first or the last name; enough digits also look into parents' phones. */
export function searchFilter(search: string | undefined): Prisma.StudentWhereInput | null {
  const words = (search ?? '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const byName: Prisma.StudentWhereInput = {
    AND: words.map((word) => ({
      OR: [
        { firstName: { contains: word, mode: 'insensitive' } },
        { lastName: { contains: word, mode: 'insensitive' } },
      ],
    })),
  };
  const digits = (search ?? '').replace(/\D/g, '');
  if (digits.length < SEARCH_PHONE_DIGITS_MIN) return byName;
  return {
    OR: [byName, { guardians: { some: { membership: { phone: { contains: digits } } } } }],
  };
}

/** Students, their parents and the parent links for Telegram (TZ FR-17, FR-19, FR-20). */
@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: PlanLimitsService,
    private readonly invites: InvitesService,
  ) {}

  async list(schoolId: string, query: ListStudentsQuery): Promise<StudentListResponse> {
    const conditions: Prisma.StudentWhereInput[] = [
      { schoolId, archivedAt: query.archived ? { not: null } : null },
    ];
    const search = searchFilter(query.search);
    if (search) conditions.push(search);
    if (query.groupId) {
      conditions.push({ enrollments: { some: { status: 'active', groupId: query.groupId } } });
    }
    if (query.courseId) {
      conditions.push({
        enrollments: { some: { status: 'active', group: { courseId: query.courseId } } },
      });
    }
    const where: Prisma.StudentWhereInput = { AND: conditions };

    // Every round trip to the database counts towards FR-19's 300 ms: the page of students,
    // then its parents and groups as two joins in parallel, whatever the page size.
    const [total, rows] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        select: listSelect,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * STUDENTS_PAGE_SIZE,
        take: STUDENTS_PAGE_SIZE,
      }),
    ]);
    const ids = rows.map((row) => row.id);
    const [guardians, groups] =
      ids.length === 0
        ? [[], []]
        : await Promise.all([
            this.prisma.$queryRaw<ListGuardianRow[]>`
              SELECT sg.id, sg.student_id AS "studentId", m.id AS "membershipId",
                     m.display_name AS name, m.phone, m.status
              FROM student_guardians sg
              JOIN memberships m ON m.id = sg.membership_id
              WHERE sg.school_id = ${schoolId}::uuid AND sg.student_id = ANY(${ids}::uuid[])
              ORDER BY sg.created_at, sg.id`,
            this.prisma.$queryRaw<ListGroupRow[]>`
              SELECT e.id AS "enrollmentId", e.student_id AS "studentId", g.id, g.name,
                     c.color AS "courseColor"
              FROM enrollments e
              JOIN groups g ON g.id = e.group_id
              JOIN courses c ON c.id = g.course_id
              WHERE e.school_id = ${schoolId}::uuid AND e.student_id = ANY(${ids}::uuid[])
                AND e.status = 'active'
              ORDER BY e.enrolled_on, e.id`,
          ]);
    const guardiansOf = groupBy(guardians);
    const groupsOf = groupBy(groups);
    return {
      items: rows.map((row) =>
        toListItem(row, guardiansOf.get(row.id) ?? [], groupsOf.get(row.id) ?? []),
      ),
      total,
      page: query.page,
      pageSize: STUDENTS_PAGE_SIZE,
    };
  }

  async get(schoolId: string, id: string): Promise<StudentDetailDto> {
    return toDetail(await this.find(this.prisma, schoolId, id));
  }

  async create(
    schoolId: string,
    data: CreateStudentRequest,
    actorId: string,
  ): Promise<StudentGuardianChangeResponse> {
    await this.limits.assertCanAddStudent(schoolId);
    const result = await this.prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          schoolId,
          firstName: data.firstName,
          lastName: data.lastName,
          birthDate: fromDateString(data.birthDate ?? null),
          comment: data.comment ?? null,
          createdBy: 'admin',
        },
      });
      await this.audit(tx, schoolId, actorId, 'Student', student.id, 'create', null, {
        ...snapshot(student),
        createdBy: 'admin',
      });
      const guardianReused = await this.linkGuardian(
        tx,
        schoolId,
        student.id,
        data.guardian,
        actorId,
      );
      return { id: student.id, guardianReused };
    }, TX_OPTIONS);
    return { student: await this.get(schoolId, result.id), guardianReused: result.guardianReused };
  }

  async update(
    schoolId: string,
    id: string,
    data: UpdateStudentRequest,
    actorId: string,
  ): Promise<StudentDetailDto> {
    const before = await this.find(this.prisma, schoolId, id);
    const current = snapshot(before);
    const next = {
      firstName: data.firstName ?? current.firstName,
      lastName: data.lastName ?? current.lastName,
      birthDate: data.birthDate !== undefined ? data.birthDate : current.birthDate,
      comment: data.comment !== undefined ? data.comment : current.comment,
    };
    const diff = snapshotDiff(current, next);
    if (diff.fields.length === 0) return toDetail(before);
    await this.prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: {
          firstName: next.firstName,
          lastName: next.lastName,
          birthDate: fromDateString(next.birthDate),
          comment: next.comment,
        },
      });
      await this.audit(tx, schoolId, actorId, 'Student', id, 'update', diff.before, diff.after);
    });
    return this.get(schoolId, id);
  }

  /**
   * Archiving closes the active enrollments today (T-18, decision 7); restoring takes a plan
   * seat again and brings no enrollment back.
   */
  async setArchived(
    schoolId: string,
    id: string,
    archived: boolean,
    actorId: string,
  ): Promise<StudentDetailDto> {
    const before = await this.find(this.prisma, schoolId, id);
    if (Boolean(before.archivedAt) === archived) return toDetail(before);
    if (!archived) await this.limits.assertCanAddStudent(schoolId);

    const today = archived ? await schoolToday(this.prisma, schoolId) : null;
    const archivedAt = archived ? new Date() : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.student.update({ where: { id }, data: { archivedAt } });
      let closed: string[] = [];
      if (today) {
        const active = await tx.enrollment.findMany({
          where: { schoolId, studentId: id, status: 'active' },
          select: { id: true },
        });
        closed = active.map((row) => row.id);
        // An enrollment that starts in the future ends on its own first day, never before it:
        // a plain leave refuses such a date too.
        await tx.$executeRaw`
          UPDATE enrollments
          SET status = 'left', left_on = GREATEST(enrolled_on, ${today}::date), updated_at = now()
          WHERE school_id = ${schoolId}::uuid AND id = ANY(${closed}::uuid[])`;
      }
      await this.audit(
        tx,
        schoolId,
        actorId,
        'Student',
        id,
        archived ? 'archive' : 'unarchive',
        { archivedAt: before.archivedAt?.toISOString() ?? null },
        {
          archivedAt: archivedAt?.toISOString() ?? null,
          ...(today && { closedEnrollments: closed, leftOn: today }),
        },
      );
    }, TX_OPTIONS);
    return this.get(schoolId, id);
  }

  async addGuardian(
    schoolId: string,
    id: string,
    data: GuardianInput,
    actorId: string,
  ): Promise<StudentGuardianChangeResponse> {
    await this.find(this.prisma, schoolId, id);
    let guardianReused: boolean;
    try {
      guardianReused = await this.prisma.$transaction(
        (tx) => this.linkGuardian(tx, schoolId, id, data, actorId),
        TX_OPTIONS,
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      throw new AppError('GUARDIAN_ALREADY_LINKED', 'This parent is already linked', 409);
    }
    return { student: await this.get(schoolId, id), guardianReused };
  }

  /** Unlinks a parent from this student; the parent membership itself stays. */
  async removeGuardian(
    schoolId: string,
    id: string,
    guardianId: string,
    actorId: string,
  ): Promise<StudentDetailDto> {
    await this.find(this.prisma, schoolId, id);
    const link = await this.prisma.studentGuardian.findFirst({
      where: { id: guardianId, studentId: id, schoolId },
    });
    if (!link) throw guardianNotFound();
    await this.prisma.$transaction(async (tx) => {
      await tx.studentGuardian.delete({ where: { id: link.id } });
      await this.audit(
        tx,
        schoolId,
        actorId,
        'StudentGuardian',
        link.id,
        'delete',
        { studentId: id, membershipId: link.membershipId, relation: link.relation },
        {},
      );
    });
    return this.get(schoolId, id);
  }

  /** A 30-day link for a parent who has not entered through Telegram yet (T-18, decision 4). */
  async issueInvite(
    schoolId: string,
    id: string,
    guardianId: string,
    actorId: string,
  ): Promise<InviteLinkResponse> {
    await this.find(this.prisma, schoolId, id);
    const link = await this.prisma.studentGuardian.findFirst({
      where: { id: guardianId, studentId: id, schoolId },
      include: { membership: { select: { id: true, status: true } } },
    });
    if (!link) throw guardianNotFound();
    if (link.membership.status === 'active') {
      throw new AppError('GUARDIAN_ALREADY_JOINED', 'This parent has already joined', 409);
    }
    if (link.membership.status === 'deactivated') {
      throw new AppError('GUARDIAN_DEACTIVATED', 'This parent is deactivated', 409);
    }
    return this.invites.issue({
      schoolId,
      membershipId: link.membership.id,
      ttlHours: PARENT_INVITE_TTL_HOURS,
      actorId,
    });
  }

  /**
   * One parent, several children (T-18, decision 2): a parent of the school with the same
   * normalized phone gets the new link instead of a second placeholder.
   */
  private async linkGuardian(
    tx: Prisma.TransactionClient,
    schoolId: string,
    studentId: string,
    guardian: GuardianInput,
    actorId: string,
  ): Promise<boolean> {
    const existing = await tx.membership.findFirst({
      where: {
        schoolId,
        role: 'parent',
        phone: guardian.phone,
        status: { not: 'deactivated' },
      },
      // A parent who has joined is the better match than a placeholder nobody accepted; the
      // enum order is invited, active.
      orderBy: [{ status: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    let membershipId = existing?.id;
    if (!membershipId) {
      const created = await tx.membership.create({
        data: { schoolId, role: 'parent', displayName: guardian.name, phone: guardian.phone },
      });
      membershipId = created.id;
      await this.audit(tx, schoolId, actorId, 'Membership', created.id, 'create', null, {
        role: 'parent',
      });
    }
    const link = await tx.studentGuardian.create({
      data: { schoolId, studentId, membershipId, relation: guardian.relation },
    });
    await this.audit(tx, schoolId, actorId, 'StudentGuardian', link.id, 'create', null, {
      studentId,
      membershipId,
      relation: guardian.relation,
      reused: Boolean(existing),
    });
    return Boolean(existing);
  }

  private async find(
    db: Prisma.TransactionClient,
    schoolId: string,
    id: string,
  ): Promise<DetailRow> {
    const row = await db.student.findFirst({
      where: { id, schoolId },
      include: detailInclude(new Date()),
    });
    if (!row) throw studentNotFound();
    return row;
  }

  private async audit(
    tx: Prisma.TransactionClient,
    schoolId: string,
    actorUserId: string,
    entity: string,
    entityId: string,
    action: string,
    before: Prisma.InputJsonObject | null,
    after: Prisma.InputJsonObject,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        schoolId,
        actorUserId,
        entity,
        entityId,
        action,
        before: before ?? undefined,
        after,
      },
    });
  }
}

function toListItem(
  row: ListRow,
  guardians: ListGuardianRow[],
  groups: ListGroupRow[],
): StudentListItemDto {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    birthDate: toDateString(row.birthDate),
    createdBy: row.createdBy,
    archived: row.archivedAt !== null,
    guardians: guardians.map((link) => ({
      id: link.id,
      membershipId: link.membershipId,
      name: link.name,
      phone: link.phone,
      joined: link.status === 'active',
    })),
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      courseColor: group.courseColor,
      enrollmentId: group.enrollmentId,
    })),
  };
}

function toDetail(row: DetailRow): StudentDetailDto {
  const active = row.enrollments.filter((enrollment) => enrollment.status === 'active');
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    birthDate: toDateString(row.birthDate),
    createdBy: row.createdBy,
    archived: row.archivedAt !== null,
    comment: row.comment,
    guardians: row.guardians.map((link) => {
      const joined = link.membership.status === 'active';
      return {
        id: link.id,
        membershipId: link.membership.id,
        name: link.membership.displayName,
        phone: link.membership.phone,
        joined,
        relation: link.relation,
        inviteExpiresAt:
          !joined && link.membership.status === 'invited'
            ? (link.membership.inviteTokens[0]?.expiresAt.toISOString() ?? null)
            : null,
      };
    }),
    groups: active.map((enrollment) => ({
      id: enrollment.group.id,
      name: enrollment.group.name,
      courseColor: enrollment.group.course.color,
      enrollmentId: enrollment.id,
    })),
    enrollments: row.enrollments.map(toEnrollmentDto),
  };
}
