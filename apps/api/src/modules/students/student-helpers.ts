import { todayIn, type EnrollmentDto } from '@darsi/shared';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { toDateString } from '../courses/snapshot-diff';

/** Several round trips to a remote database; the 5 s default is too tight for Neon. */
export const TX_OPTIONS = { timeout: 20_000, maxWait: 10_000 };

/** A `YYYY-MM-DD` value for a `date` column: midnight UTC. */
export const dateOnly = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

export const studentNotFound = () => new AppError('STUDENT_NOT_FOUND', 'Student not found', 404);

export const enrollmentInclude = {
  group: {
    select: {
      id: true,
      name: true,
      archivedAt: true,
      course: { select: { id: true, name: true, color: true } },
    },
  },
} satisfies Prisma.EnrollmentInclude;

export type EnrollmentRow = Prisma.EnrollmentGetPayload<{ include: typeof enrollmentInclude }>;

export function toEnrollmentDto(row: EnrollmentRow): EnrollmentDto {
  return {
    id: row.id,
    studentId: row.studentId,
    enrolledOn: row.enrolledOn.toISOString().slice(0, 10),
    leftOn: toDateString(row.leftOn),
    status: row.status,
    group: { id: row.group.id, name: row.group.name, archived: row.group.archivedAt !== null },
    course: {
      id: row.group.course.id,
      name: row.group.course.name,
      color: row.group.course.color,
    },
  };
}

/** Today's date on the school's wall clock: enrollment dates follow the school, not UTC. */
export async function schoolToday(db: Prisma.TransactionClient, schoolId: string): Promise<string> {
  const school = await db.school.findUniqueOrThrow({
    where: { id: schoolId },
    select: { timezone: true },
  });
  return todayIn(school.timezone, new Date());
}
