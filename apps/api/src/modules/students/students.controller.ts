import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  addGuardianRequestSchema,
  createStudentRequestSchema,
  enrollStudentRequestSchema,
  idParamSchema,
  issueGuardianInviteRequestSchema,
  leaveEnrollmentRequestSchema,
  listStudentsQuerySchema,
  transferEnrollmentRequestSchema,
  updateStudentRequestSchema,
  type AddGuardianRequest,
  type CreateStudentRequest,
  type EnrollmentDto,
  type EnrollStudentRequest,
  type InviteLinkResponse,
  type IssueGuardianInviteRequest,
  type LeaveEnrollmentRequest,
  type ListStudentsQuery,
  type StudentDetailDto,
  type StudentGuardianChangeResponse,
  type StudentListResponse,
  type TransferEnrollmentRequest,
  type UpdateStudentRequest,
} from '@darsi/shared';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import type { SchoolContext } from '../tenancy/tenancy.constants';
import { CurrentSchool, SchoolRoles } from '../tenancy/tenancy.decorators';
import { EnrollmentsService } from './enrollments.service';
import { StudentsService } from './students.service';

const idParam = new ZodValidationPipe(idParamSchema);

/** Owners and admins keep the student list; teachers see their groups in T-23. */
@Controller('students')
@SchoolRoles('owner', 'admin')
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly enrollments: EnrollmentsService,
  ) {}

  @Get()
  list(
    @CurrentSchool() school: SchoolContext,
    @Query(new ZodValidationPipe(listStudentsQuerySchema)) query: ListStudentsQuery,
  ): Promise<StudentListResponse> {
    return this.students.list(school.schoolId, query);
  }

  @Post()
  create(
    @CurrentSchool() school: SchoolContext,
    @Body(new ZodValidationPipe(createStudentRequestSchema)) body: CreateStudentRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<StudentGuardianChangeResponse> {
    return this.students.create(school.schoolId, body, user.id);
  }

  @Get(':id')
  get(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
  ): Promise<StudentDetailDto> {
    return this.students.get(school.schoolId, id);
  }

  @Patch(':id')
  update(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateStudentRequestSchema)) body: UpdateStudentRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<StudentDetailDto> {
    return this.students.update(school.schoolId, id, body, user.id);
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<StudentDetailDto> {
    return this.students.setArchived(school.schoolId, id, true, user.id);
  }

  @Post(':id/unarchive')
  @HttpCode(200)
  unarchive(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<StudentDetailDto> {
    return this.students.setArchived(school.schoolId, id, false, user.id);
  }

  @Post(':id/guardians')
  addGuardian(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(addGuardianRequestSchema)) body: AddGuardianRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<StudentGuardianChangeResponse> {
    return this.students.addGuardian(school.schoolId, id, body, user.id);
  }

  @Delete(':id/guardians/:guardianId')
  removeGuardian(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @Param('guardianId', idParam) guardianId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<StudentDetailDto> {
    return this.students.removeGuardian(school.schoolId, id, guardianId, user.id);
  }

  @Post(':id/invite')
  issueInvite(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(issueGuardianInviteRequestSchema))
    body: IssueGuardianInviteRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<InviteLinkResponse> {
    return this.students.issueInvite(school.schoolId, id, body.guardianId, user.id);
  }

  @Post(':id/enrollments')
  enroll(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(enrollStudentRequestSchema)) body: EnrollStudentRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<EnrollmentDto> {
    return this.enrollments.enroll(school.schoolId, id, body, user.id);
  }
}

@Controller('enrollments')
@SchoolRoles('owner', 'admin')
export class EnrollmentsController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  @Post(':id/leave')
  @HttpCode(200)
  leave(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(leaveEnrollmentRequestSchema)) body: LeaveEnrollmentRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<EnrollmentDto> {
    return this.enrollments.leave(school.schoolId, id, body, user.id);
  }

  @Post(':id/transfer')
  @HttpCode(200)
  transfer(
    @CurrentSchool() school: SchoolContext,
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(transferEnrollmentRequestSchema)) body: TransferEnrollmentRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<EnrollmentDto> {
    return this.enrollments.transfer(school.schoolId, id, body, user.id);
  }
}
