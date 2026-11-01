import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@darsi/shared';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SCHOOL_HEADER, SCHOOL_ROLES, type TenantRequest } from './tenancy.constants';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves the school from X-School-Id and checks the user's active membership in it (TZ FR-5).
 * A school the user does not belong to answers 404, so its existence is not revealed.
 * Superadmins get no implicit access to school data (TZ §3).
 */
@Injectable()
export class SchoolGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowed =
      this.reflector.getAllAndOverride<Role[]>(SCHOOL_ROLES, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const request = context.switchToHttp().getRequest<TenantRequest>();
    if (!request.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const header = request.headers[SCHOOL_HEADER];
    const schoolId = Array.isArray(header) ? header[0] : header;
    if (!schoolId || !UUID.test(schoolId)) {
      throw new AppError(
        'SCHOOL_ID_REQUIRED',
        'X-School-Id header with a school id is required',
        400,
      );
    }

    const memberships = await this.prisma.membership.findMany({
      where: { schoolId, userId: request.user.id, status: 'active' },
      select: { role: true, school: { select: { status: true } } },
    });
    const first = memberships[0];
    if (!first) {
      throw new AppError('SCHOOL_NOT_FOUND', 'School not found', 404);
    }
    if (first.school.status === 'blocked') {
      throw new AppError('SCHOOL_BLOCKED', 'The school is blocked', 403);
    }

    const roles = memberships.map((m) => m.role);
    if (allowed.length > 0 && !roles.some((role) => allowed.includes(role))) {
      throw new AppError('FORBIDDEN_ROLE', 'Your role does not allow this action', 403);
    }

    request.school = { schoolId, roles };
    return true;
  }
}
