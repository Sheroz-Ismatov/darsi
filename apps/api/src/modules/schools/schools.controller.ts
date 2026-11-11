import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  updateSchoolSettingsRequestSchema,
  type SchoolDto,
  type UpdateSchoolSettingsRequest,
} from '@darsi/shared';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import type { SchoolContext } from '../tenancy/tenancy.constants';
import { CurrentSchool, SchoolRoles } from '../tenancy/tenancy.decorators';
import { SchoolsService } from './schools.service';

/** The school selected by X-School-Id. Teachers and parents get their own views in the Mini App. */
@Controller('school')
export class SchoolsController {
  constructor(private readonly schools: SchoolsService) {}

  @Get()
  @SchoolRoles('owner', 'admin')
  get(@CurrentSchool() school: SchoolContext): Promise<SchoolDto> {
    return this.schools.get(school.schoolId);
  }

  @Patch()
  @SchoolRoles('owner')
  update(
    @CurrentSchool() school: SchoolContext,
    @Body(new ZodValidationPipe(updateSchoolSettingsRequestSchema))
    body: UpdateSchoolSettingsRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<SchoolDto> {
    return this.schools.update(school.schoolId, body, user.id);
  }
}
