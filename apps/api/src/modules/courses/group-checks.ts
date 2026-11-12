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

/**
 * Students taking a seat in each group.
 * TODO(T-18): count active enrollments once they exist; until then every group is empty.
 */
export function countEnrolled(_db: Db, groupIds: string[]): Promise<Map<string, number>> {
  return Promise.resolve(new Map(groupIds.map((id) => [id, 0])));
}
