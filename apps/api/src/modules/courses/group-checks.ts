import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Teachers are set up before they join, so an invited membership counts (T-15, decision 6).
 * Groups and single lessons check a newly chosen teacher the same way.
 */
export async function assertTeacher(db: Db, schoolId: string, membershipId: string) {
  const teacher = await db.membership.findFirst({
    where: {
      id: membershipId,
      schoolId,
      role: 'teacher',
      status: { in: ['active', 'invited'] },
    },
    select: { id: true },
  });
  if (!teacher) throw new AppError('TEACHER_NOT_FOUND', 'Teacher not found', 422);
}

/** Students taking a seat in each group: active enrollments, one query for all groups. */
export async function countEnrolled(db: Db, groupIds: string[]): Promise<Map<string, number>> {
  const counts = new Map(groupIds.map((id) => [id, 0]));
  if (groupIds.length === 0) return counts;
  const rows = await db.enrollment.groupBy({
    by: ['groupId'],
    where: { groupId: { in: groupIds }, status: 'active' },
    _count: { _all: true },
  });
  for (const row of rows) counts.set(row.groupId, row._count._all);
  return counts;
}
