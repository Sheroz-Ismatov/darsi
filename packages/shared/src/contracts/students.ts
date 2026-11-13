import { z } from 'zod';
import type { CourseColor } from '../constants';
import { normalizePhone } from '../domain/phone';

export const STUDENTS_PAGE_SIZE = 50;
export const STUDENT_NAME_MAX = 60;
export const STUDENT_COMMENT_MAX = 1000;
export const BIRTH_YEAR_MIN = 1900;
/** A search string with at least this many digits looks into parents' phones too (T-18). */
export const SEARCH_PHONE_DIGITS_MIN = 4;

export const STUDENT_SOURCES = ['admin', 'parent'] as const;
export type StudentSource = (typeof STUDENT_SOURCES)[number];

/** `self` is an adult student who is their own contact. */
export const GUARDIAN_RELATIONS = ['mother', 'father', 'self', 'other'] as const;
export type GuardianRelation = (typeof GUARDIAN_RELATIONS)[number];

export const ENROLLMENT_STATUSES = ['active', 'left'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

const nameSchema = z.string().trim().min(1).max(STUDENT_NAME_MAX);

/** Stored as `+` and digits, so one parent is found however the number was typed. */
export const studentPhoneSchema = z
  .string()
  .trim()
  .max(32)
  .transform((value, ctx) => {
    const phone = normalizePhone(value);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'Invalid phone number' });
      return z.NEVER;
    }
    return phone;
  });

// The package has no DOM or Node types, so "today" is the UTC date; one day of slack keeps
// a birth registered today east of UTC valid.
const latestBirthDate = (): string =>
  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const birthDateSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || z.iso.date().safeParse(value).success, 'Invalid date')
  .refine(
    (value) => value === '' || (value >= `${BIRTH_YEAR_MIN}-01-01` && value <= latestBirthDate()),
    'Birth date is out of range',
  )
  .transform((value) => (value === '' ? null : value))
  .nullable();

const commentSchema = z
  .string()
  .trim()
  .max(STUDENT_COMMENT_MAX)
  .transform((value) => (value === '' ? null : value))
  .nullable();

const archivedFlag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const notEmpty = (value: object): boolean => Object.keys(value).length > 0;

// ---------- Requests ----------

/** GET /students */
export const listStudentsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  courseId: z.uuid().optional(),
  groupId: z.uuid().optional(),
  archived: archivedFlag,
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;

/** A parent typed in by the admin; becomes an invited `parent` membership (T-18, decision 1). */
export const guardianInputSchema = z.object({
  name: nameSchema,
  phone: studentPhoneSchema,
  relation: z.enum(GUARDIAN_RELATIONS),
});
export type GuardianInput = z.infer<typeof guardianInputSchema>;

const studentFields = {
  firstName: nameSchema,
  lastName: nameSchema,
  birthDate: birthDateSchema,
  comment: commentSchema,
};

/** POST /students */
export const createStudentRequestSchema = z.object({
  ...studentFields,
  birthDate: studentFields.birthDate.optional(),
  comment: studentFields.comment.optional(),
  guardian: guardianInputSchema,
});
export type CreateStudentRequest = z.infer<typeof createStudentRequestSchema>;
export type CreateStudentInput = z.input<typeof createStudentRequestSchema>;

/** PATCH /students/:id */
export const updateStudentRequestSchema = z
  .object(studentFields)
  .partial()
  .refine(notEmpty, 'Nothing to update');
export type UpdateStudentRequest = z.infer<typeof updateStudentRequestSchema>;
export type UpdateStudentInput = z.input<typeof updateStudentRequestSchema>;

/** POST /students/:id/guardians */
export const addGuardianRequestSchema = guardianInputSchema;
export type AddGuardianRequest = GuardianInput;

/** POST /students/:id/invite — `guardianId` is the id of the parent link of this student. */
export const issueGuardianInviteRequestSchema = z.object({ guardianId: z.uuid() });
export type IssueGuardianInviteRequest = z.infer<typeof issueGuardianInviteRequestSchema>;

/** POST /students/:id/enrollments — `enrolledOn` defaults to today in the school's time zone. */
export const enrollStudentRequestSchema = z.object({
  groupId: z.uuid(),
  enrolledOn: z.iso.date().optional(),
  force: z.boolean().optional(),
});
export type EnrollStudentRequest = z.infer<typeof enrollStudentRequestSchema>;

/** POST /enrollments/:id/leave */
export const leaveEnrollmentRequestSchema = z.object({ leftOn: z.iso.date().optional() });
export type LeaveEnrollmentRequest = z.infer<typeof leaveEnrollmentRequestSchema>;

/** POST /enrollments/:id/transfer — the old enrollment ends and the new one starts on `date`. */
export const transferEnrollmentRequestSchema = z.object({
  groupId: z.uuid(),
  date: z.iso.date().optional(),
  force: z.boolean().optional(),
});
export type TransferEnrollmentRequest = z.infer<typeof transferEnrollmentRequestSchema>;

// ---------- Responses ----------

export interface StudentGuardianDto {
  /** Id of the parent–student link: used to unlink and to issue the Telegram link. */
  id: string;
  membershipId: string;
  name: string;
  phone: string | null;
  /** The parent has entered the school through Telegram. */
  joined: boolean;
}

export interface StudentGroupDto {
  id: string;
  name: string;
  courseColor: CourseColor;
  /** The active enrollment that puts the student into this group. */
  enrollmentId: string;
}

export interface StudentListItemDto {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  createdBy: StudentSource;
  archived: boolean;
  guardians: StudentGuardianDto[];
  /** Groups of the active enrollments. */
  groups: StudentGroupDto[];
}

/** GET /students */
export interface StudentListResponse {
  items: StudentListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StudentGuardianDetailDto extends StudentGuardianDto {
  relation: GuardianRelation;
  /** Set while an unused, unexpired link exists for a parent who has not joined. */
  inviteExpiresAt: string | null;
}

export interface EnrollmentDto {
  id: string;
  studentId: string;
  enrolledOn: string;
  leftOn: string | null;
  status: EnrollmentStatus;
  group: { id: string; name: string; archived: boolean };
  course: { id: string; name: string; color: CourseColor };
}

export interface StudentDetailDto extends Omit<StudentListItemDto, 'guardians'> {
  comment: string | null;
  guardians: StudentGuardianDetailDto[];
  /** Active enrollments first, then the history, newest first. */
  enrollments: EnrollmentDto[];
}

/** POST /students and POST /students/:id/guardians */
export interface StudentGuardianChangeResponse {
  student: StudentDetailDto;
  /** The phone matched a parent already in the school, so no new one was created. */
  guardianReused: boolean;
}

/** Details of the 409 `GROUP_FULL` answer. */
export interface GroupFullDetails {
  capacity: number;
  enrolled: number;
}
