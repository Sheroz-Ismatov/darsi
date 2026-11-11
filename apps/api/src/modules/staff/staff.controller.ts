import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createStaffRequestSchema,
  idParamSchema,
  listStaffQuerySchema,
  updateStaffRequestSchema,
  type CreateStaffRequest,
  type InviteLinkResponse,
  type ListStaffQuery,
  type StaffListResponse,
  type StaffMemberDto,
  type UpdateStaffRequest,
} from '@darsi/shared';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import type { SchoolContext } from '../tenancy/tenancy.constants';
import { CurrentSchool, SchoolRoles } from '../tenancy/tenancy.decorators';
import { StaffService } from './staff.service';

const idParam = new ZodValidationPipe(idParamSchema);

/** The owner manages the staff; admins read the list to pick teachers (TZ §7.3). */
@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @SchoolRoles('owner', 'admin')
  list(
    @CurrentSchool() school: SchoolContext,
    @Query(new ZodValidationPipe(listStaffQuerySchema)) query: ListStaffQuery,
    @CurrentUser() user: AuthUser,
  ): Promise<StaffListResponse> {
    return this.staff.list(school.schoolId, user.id, query);
  }

  @Post()
  @SchoolRoles('owner')
  create(
    @CurrentSchool() school: SchoolContext,
    @Body(new ZodValidationPipe(createStaffRequestSchema)) body: CreateStaffRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<StaffMemberDto> {
    return this.staff.create(school.schoolId, body, user.id);
  }

  @Patch(':id')
  @SchoolRoles('owner')
  update(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateStaffRequestSchema)) body: UpdateStaffRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<StaffMemberDto> {
    return this.staff.update(school.schoolId, id, body, user.id);
  }

  @Post(':id/invite')
  @SchoolRoles('owner')
  issueInvite(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<InviteLinkResponse> {
    return this.staff.issueInvite(school.schoolId, id, user.id);
  }
}
