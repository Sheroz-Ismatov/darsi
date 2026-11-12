import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import {
  idParamSchema,
  listLessonsQuerySchema,
  putScheduleRulesRequestSchema,
  type LessonConflictDto,
  type LessonDto,
  type ListLessonsQuery,
  type PutScheduleRulesRequest,
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
}
