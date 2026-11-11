import { z } from 'zod';
import {
  COURSE_COLORS,
  COURSE_FORMATS,
  COURSE_ICONS,
  COURSE_KINDS,
  type CourseColor,
  type CourseFormat,
  type CourseIcon,
  type CourseKind,
} from '../constants';

export const AGE_MIN = 0;
export const AGE_MAX = 99;
export const GROUP_CAPACITY_MAX = 500;

/** Optional value of a form: an empty string clears it, so it is stored as null. */
const emptyToNull = (value: string): string | null => (value === '' ? null : value);

const ageSchema = z.number().int().min(AGE_MIN).max(AGE_MAX).nullable();

function isHttpsUrl(value: string): boolean {
  if (!value.startsWith('https://')) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/** A calendar date without time, `YYYY-MM-DD`. */
const clearableDate = z
  .string()
  .trim()
  .refine((value) => value === '' || z.iso.date().safeParse(value).success, 'Invalid date')
  .transform(emptyToNull)
  .nullable();

/** `?archived=true` lists archived records, anything else the active ones. */
const archivedFlag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const ageOrder = (value: { ageFrom?: number | null; ageTo?: number | null }): boolean =>
  value.ageFrom == null || value.ageTo == null || value.ageFrom <= value.ageTo;

const dateOrder = (value: { startsOn?: string | null; endsOn?: string | null }): boolean =>
  value.startsOn == null || value.endsOn == null || value.startsOn <= value.endsOn;

const notEmpty = (value: object): boolean => Object.keys(value).length > 0;

// ---------- Courses (TZ FR-11) ----------

const courseFields = {
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).transform(emptyToNull).nullable(),
  format: z.enum(COURSE_FORMATS),
  kind: z.enum(COURSE_KINDS),
  ageFrom: ageSchema,
  ageTo: ageSchema,
  showInCatalog: z.boolean(),
  color: z.enum(COURSE_COLORS),
  icon: z.enum(COURSE_ICONS),
};

/** GET /courses */
export const listCoursesQuerySchema = z.object({ archived: archivedFlag });
export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;

/** POST /courses */
export const createCourseRequestSchema = z
  .object({
    ...courseFields,
    description: courseFields.description.optional(),
    ageFrom: ageSchema.optional(),
    ageTo: ageSchema.optional(),
    showInCatalog: courseFields.showInCatalog.default(true),
  })
  .refine(ageOrder, { message: 'ageFrom must not exceed ageTo', path: ['ageTo'] });
export type CreateCourseRequest = z.infer<typeof createCourseRequestSchema>;
export type CreateCourseInput = z.input<typeof createCourseRequestSchema>;

/** PATCH /courses/:id — the server checks the age order against the stored values too. */
export const updateCourseRequestSchema = z
  .object(courseFields)
  .partial()
  .refine(notEmpty, 'Nothing to update')
  .refine(ageOrder, { message: 'ageFrom must not exceed ageTo', path: ['ageTo'] });
export type UpdateCourseRequest = z.infer<typeof updateCourseRequestSchema>;

/** A group as the course list shows it. */
export interface CourseGroupSummaryDto {
  id: string;
  name: string;
  teacherName: string;
  capacity: number;
  enrolledCount: number;
  freeSeats: number;
  archived: boolean;
}

export interface CourseDto {
  id: string;
  name: string;
  description: string | null;
  format: CourseFormat;
  kind: CourseKind;
  ageFrom: number | null;
  ageTo: number | null;
  showInCatalog: boolean;
  color: CourseColor;
  icon: CourseIcon;
  archived: boolean;
  createdAt: string;
  /** Every group of the course, archived ones included; active ones first. */
  groups: CourseGroupSummaryDto[];
}

// ---------- Groups (TZ FR-12) ----------

const groupFields = {
  name: z.string().trim().min(1).max(120),
  teacherMembershipId: z.uuid(),
  /** Ignored for an individual course: its groups always hold one student. */
  capacity: z.number().int().min(1).max(GROUP_CAPACITY_MAX),
  meetingUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === '' || isHttpsUrl(value), 'Use an https:// link')
    .transform(emptyToNull)
    .nullable(),
  startsOn: clearableDate,
  endsOn: clearableDate,
};

/** GET /groups */
export const listGroupsQuerySchema = z.object({ courseId: z.uuid().optional() });
export type ListGroupsQuery = z.infer<typeof listGroupsQuerySchema>;

/** POST /groups */
export const createGroupRequestSchema = z
  .object({
    courseId: z.uuid(),
    ...groupFields,
    meetingUrl: groupFields.meetingUrl.optional(),
    startsOn: groupFields.startsOn.optional(),
    endsOn: groupFields.endsOn.optional(),
  })
  .refine(dateOrder, { message: 'endsOn must not precede startsOn', path: ['endsOn'] });
export type CreateGroupRequest = z.infer<typeof createGroupRequestSchema>;
export type CreateGroupInput = z.input<typeof createGroupRequestSchema>;

/** PATCH /groups/:id — a group never moves to another course. */
export const updateGroupRequestSchema = z
  .object(groupFields)
  .partial()
  .refine(notEmpty, 'Nothing to update')
  .refine(dateOrder, { message: 'endsOn must not precede startsOn', path: ['endsOn'] });
export type UpdateGroupRequest = z.infer<typeof updateGroupRequestSchema>;

export interface GroupDto {
  id: string;
  name: string;
  capacity: number;
  meetingUrl: string | null;
  startsOn: string | null;
  endsOn: string | null;
  archived: boolean;
  createdAt: string;
  course: {
    id: string;
    name: string;
    color: CourseColor;
    icon: CourseIcon;
    kind: CourseKind;
    format: CourseFormat;
    archived: boolean;
  };
  /** Membership id and name of the teacher. */
  teacher: { id: string; displayName: string };
  enrolledCount: number;
  freeSeats: number;
}
