import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createCourseRequestSchema,
  createGroupRequestSchema,
  idParamSchema,
  listCoursesQuerySchema,
  listGroupsQuerySchema,
  updateCourseRequestSchema,
  updateGroupRequestSchema,
  type CourseDto,
  type CreateCourseRequest,
  type CreateGroupRequest,
  type GroupDto,
  type ListCoursesQuery,
  type ListGroupsQuery,
  type UpdateCourseRequest,
  type UpdateGroupRequest,
} from '@darsi/shared';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import type { SchoolContext } from '../tenancy/tenancy.constants';
import { CurrentSchool, SchoolRoles } from '../tenancy/tenancy.decorators';
import { CoursesService } from './courses.service';
import { GroupsService } from './groups.service';

const idParam = new ZodValidationPipe(idParamSchema);

/** Owners and admins manage the catalog; teachers and parents read it in the Mini App (T-23, T-33). */
@Controller('courses')
@SchoolRoles('owner', 'admin')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  list(
    @CurrentSchool() school: SchoolContext,
    @Query(new ZodValidationPipe(listCoursesQuerySchema)) query: ListCoursesQuery,
  ): Promise<CourseDto[]> {
    return this.courses.list(school.schoolId, query);
  }

  @Post()
  create(
    @CurrentSchool() school: SchoolContext,
    @Body(new ZodValidationPipe(createCourseRequestSchema)) body: CreateCourseRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<CourseDto> {
    return this.courses.create(school.schoolId, body, user.id);
  }

  @Patch(':id')
  update(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateCourseRequestSchema)) body: UpdateCourseRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<CourseDto> {
    return this.courses.update(school.schoolId, id, body, user.id);
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<CourseDto> {
    return this.courses.setArchived(school.schoolId, id, true, user.id);
  }

  @Post(':id/unarchive')
  @HttpCode(200)
  unarchive(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<CourseDto> {
    return this.courses.setArchived(school.schoolId, id, false, user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.courses.remove(school.schoolId, id, user.id);
  }
}

@Controller('groups')
@SchoolRoles('owner', 'admin')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  list(
    @CurrentSchool() school: SchoolContext,
    @Query(new ZodValidationPipe(listGroupsQuerySchema)) query: ListGroupsQuery,
  ): Promise<GroupDto[]> {
    return this.groups.list(school.schoolId, query);
  }

  @Get(':id')
  get(@CurrentSchool() school: SchoolContext, @Param('id', idParam) id: string): Promise<GroupDto> {
    return this.groups.get(school.schoolId, id);
  }

  @Post()
  create(
    @CurrentSchool() school: SchoolContext,
    @Body(new ZodValidationPipe(createGroupRequestSchema)) body: CreateGroupRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<GroupDto> {
    return this.groups.create(school.schoolId, body, user.id);
  }

  @Patch(':id')
  update(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateGroupRequestSchema)) body: UpdateGroupRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<GroupDto> {
    return this.groups.update(school.schoolId, id, body, user.id);
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<GroupDto> {
    return this.groups.setArchived(school.schoolId, id, true, user.id);
  }

  @Post(':id/unarchive')
  @HttpCode(200)
  unarchive(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<GroupDto> {
    return this.groups.setArchived(school.schoolId, id, false, user.id);
  }
}
