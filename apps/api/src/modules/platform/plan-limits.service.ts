import { Injectable } from '@nestjs/common';
import type { Role } from '@darsi/shared';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';

export const STAFF_ROLES: Role[] = ['owner', 'admin', 'teacher'];

/** A person: the user when linked, otherwise the invited membership itself. */
const personKey = (m: { id: string; userId: string | null }): string => m.userId ?? m.id;

/** One person may hold several staff roles; invited memberships have no user yet. */
export function countStaff(memberships: Array<{ id: string; userId: string | null }>): number {
  return new Set(memberships.map(personKey)).size;
}

export interface StaffUsage {
  used: number;
  max: number;
}

/** Plan limits (TZ FR-6). Feature modules call the matching assert before creating a record. */
@Injectable()
export class PlanLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Staff seats taken (invited people included) and the plan maximum. */
  async staffUsage(schoolId: string): Promise<StaffUsage> {
    const { max, people } = await this.loadStaff(schoolId);
    return { used: people.size, max };
  }

  /**
   * Call before adding a person to the staff. A user who already holds a seat in this school
   * (another active or invited staff role) takes no extra one.
   */
  async assertCanAddStaff(schoolId: string, userId?: string | null): Promise<void> {
    const { max, people } = await this.loadStaff(schoolId);
    if (userId && people.has(userId)) return;
    if (people.size >= max) {
      throw new AppError(
        'PLAN_LIMIT_REACHED',
        `The plan allows at most ${max} staff members`,
        422,
        { limit: 'staff', max },
      );
    }
  }

  /** Call before adding a student or bringing one back from the archive (T-18, decision 8). */
  async assertCanAddStudent(schoolId: string): Promise<void> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        plan: { select: { maxStudents: true } },
        _count: { select: { students: { where: { archivedAt: null } } } },
      },
    });
    if (!school) {
      throw new AppError('SCHOOL_NOT_FOUND', 'School not found', 404);
    }
    const max = school.plan.maxStudents;
    if (school._count.students >= max) {
      throw new AppError('PLAN_LIMIT_REACHED', `The plan allows at most ${max} students`, 422, {
        limit: 'students',
        max,
      });
    }
  }

  private async loadStaff(schoolId: string): Promise<{ max: number; people: Set<string> }> {
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
    return { max: school.plan.maxStaff, people: new Set(school.memberships.map(personKey)) };
  }
}
