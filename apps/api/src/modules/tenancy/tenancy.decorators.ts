import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import type { Role } from '@darsi/shared';
import { SchoolGuard } from './school.guard';
import { SuperadminGuard } from './superadmin.guard';
import { SCHOOL_ROLES, type SchoolContext, type TenantRequest } from './tenancy.constants';

/**
 * Makes an endpoint school-scoped: requires X-School-Id and an active membership in that school.
 * With roles, at least one of them is required (matrix TZ §7.3); without, any member passes.
 * Runs after the global JwtAuthGuard.
 */
export function SchoolRoles(...roles: Role[]): MethodDecorator & ClassDecorator {
  return applyDecorators(SetMetadata(SCHOOL_ROLES, roles), UseGuards(SchoolGuard));
}

/** Platform-level endpoint for superadmins only. */
export function SuperadminOnly(): MethodDecorator & ClassDecorator {
  return applyDecorators(UseGuards(SuperadminGuard));
}

/** The school resolved by SchoolGuard. */
export const CurrentSchool = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): SchoolContext => {
    const school = ctx.switchToHttp().getRequest<TenantRequest>().school;
    if (!school) {
      throw new Error('CurrentSchool used on a route without @SchoolRoles()');
    }
    return school;
  },
);
