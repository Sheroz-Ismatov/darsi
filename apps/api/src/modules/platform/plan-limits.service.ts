import { Injectable } from '@nestjs/common';
import type { Role } from '@darsi/shared';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';

export const STAFF_ROLES: Role[] = ['owner', 'admin', 'teacher'];

/** One person may hold several staff roles; invited memberships have no user yet. */
export function countStaff(memberships: Array<{ id: string; userId: string | null }>): number {
  return new Set(memberships.map((m) => m.userId ?? m.id)).size;
}

/**
 * Plan limits (TZ FR-6). Feature modules call the matching assert before creating a record.
 * TODO(T-18): assertCanAddStudent once the Student model exists.
 */
@Injectable()
export class PlanLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Call before adding a new person to the staff; a second role for the same person is free. */
  async assertCanAddStaff(schoolId: string): Promise<void> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        plan: { select: { maxStaff: true } },
        memberships: {
          where: { role: { in: STAFF_ROLES }, status: { not: 'deactivated' } },
          select: { id: true, userId: true },
        },
      },
    });
    if (!school) {
      throw new AppError('SCHOOL_NOT_FOUND', 'School not found', 404);
    }
    const max = school.plan.maxStaff;
    if (countStaff(school.memberships) >= max) {
      throw new AppError(
        'PLAN_LIMIT_REACHED',
        `The plan allows at most ${max} staff members`,
        422,
        {
          limit: 'staff',
          max,
        },
      );
    }
  }
}
