import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  createPlanRequestSchema,
  createSchoolRequestSchema,
  idParamSchema,
  updatePlanRequestSchema,
  updateSchoolRequestSchema,
  type CreatePlanRequest,
  type CreateSchoolRequest,
  type OwnerInviteResponse,
  type PlanDto,
  type PlatformSchoolDto,
  type UpdatePlanRequest,
  type UpdateSchoolRequest,
} from '@darsi/shared';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import { SuperadminOnly } from '../tenancy/tenancy.decorators';
import { PlatformService } from './platform.service';

const idParam = new ZodValidationPipe(idParamSchema);

@Controller('platform')
@SuperadminOnly()
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('plans')
  listPlans(): Promise<PlanDto[]> {
    return this.platform.listPlans();
  }

  @Post('plans')
  createPlan(
    @Body(new ZodValidationPipe(createPlanRequestSchema)) body: CreatePlanRequest,
  ): Promise<PlanDto> {
    return this.platform.createPlan(body);
  }

  @Patch('plans/:id')
  updatePlan(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updatePlanRequestSchema)) body: UpdatePlanRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<PlanDto> {
    return this.platform.updatePlan(id, body, user.id);
  }

  @Get('schools')
  listSchools(): Promise<PlatformSchoolDto[]> {
    return this.platform.listSchools();
  }

  @Post('schools')
  createSchool(
    @Body(new ZodValidationPipe(createSchoolRequestSchema)) body: CreateSchoolRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<PlatformSchoolDto> {
    return this.platform.createSchool(body, user.id);
  }

  @Patch('schools/:id')
  updateSchool(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateSchoolRequestSchema)) body: UpdateSchoolRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<PlatformSchoolDto> {
    return this.platform.updateSchool(id, body, user.id);
  }

  @Post('schools/:id/owner-invite')
  issueOwnerInvite(
    @Param('id', idParam) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<OwnerInviteResponse> {
    return this.platform.issueOwnerInvite(id, user.id);
  }
}
