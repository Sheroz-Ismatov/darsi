import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
  cancelLessonRequestSchema,
  createLessonRequestSchema,
  idParamSchema,
  listLessonsQuerySchema,
  putScheduleRulesRequestSchema,
  rescheduleLessonRequestSchema,
  updateLessonRequestSchema,
  type CancelLessonRequest,
  type CreateLessonRequest,
  type LessonChangeResponse,
  type LessonConflictDto,
  type LessonDetailDto,
  type LessonDto,
  type ListLessonsQuery,
  type PutScheduleRulesRequest,
  type RescheduleLessonRequest,
  type UpdateLessonRequest,
  type PutScheduleRulesResponse,
  type ScheduleRuleDto,
} from '@darsi/shared';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import type { SchoolContext } from '../tenancy/tenancy.constants';
import { CurrentSchool, SchoolRoles } from '../tenancy/tenancy.decorators';
import { LessonsService } from './lessons.service';
import { ScheduleService } from './schedule.service';

const idParam = new ZodValidationPipe(idParamSchema);

/** Owners and admins set the schedule; teachers and parents read lessons in the Mini App. */
@Controller('groups/:id')
@SchoolRoles('owner', 'admin')
export class GroupScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get('schedule-rules')
  rules(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
  ): Promise<ScheduleRuleDto[]> {
    return this.schedule.getRules(school.schoolId, id);
  }

  @Put('schedule-rules')
  replaceRules(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(putScheduleRulesRequestSchema)) body: PutScheduleRulesRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<PutScheduleRulesResponse> {
    return this.schedule.replaceRules(school.schoolId, id, body, user.id);
  }

  @Get('conflicts')
  conflicts(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
  ): Promise<LessonConflictDto[]> {
    return this.schedule.conflicts(school.schoolId, id);
  }
}

@Controller('lessons')
@SchoolRoles('owner', 'admin')
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  @Get()
  list(
    @CurrentSchool() school: SchoolContext,
    @Query(new ZodValidationPipe(listLessonsQuerySchema)) query: ListLessonsQuery,
  ): Promise<LessonDto[]> {
    return this.lessons.list(school.schoolId, query);
  }

  @Get(':id')
  get(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
  ): Promise<LessonDetailDto> {
    return this.lessons.get(school.schoolId, id);
  }

  @Post()
  create(
    @CurrentSchool() school: SchoolContext,
    @Body(new ZodValidationPipe(createLessonRequestSchema)) body: CreateLessonRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<LessonChangeResponse> {
    return this.lessons.create(school.schoolId, body, user.id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(cancelLessonRequestSchema)) body: CancelLessonRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<LessonDetailDto> {
    return this.lessons.cancel(school.schoolId, id, body, user.id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  restore(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<LessonChangeResponse> {
    return this.lessons.restore(school.schoolId, id, user.id);
  }

  @Post(':id/reschedule')
  @HttpCode(200)
  reschedule(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(rescheduleLessonRequestSchema)) body: RescheduleLessonRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<LessonChangeResponse> {
    return this.lessons.reschedule(school.schoolId, id, body, user.id);
  }

  @Patch(':id')
  update(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateLessonRequestSchema)) body: UpdateLessonRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<LessonChangeResponse> {
    return this.lessons.update(school.schoolId, id, body, user.id);
  }
}
