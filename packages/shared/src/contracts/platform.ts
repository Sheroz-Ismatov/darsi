import { z } from 'zod';
import { CURRENCIES, LOCALES, type Currency, type Locale } from '../constants';

/** Path parameter with a record id. */
export const idParamSchema = z.uuid();

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** IANA zone name, e.g. `Asia/Dushanbe`. */
export const timeZoneSchema = z.string().max(64).refine(isTimeZone, 'Unknown time zone');

/**
 * Public school code for the deep link `t.me/<bot>?start=<code>`.
 * No underscore, so it can never collide with prefixed payloads such as `inv_<token>`.
 */
export const schoolCodeSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{2,31}$/, 'Use 3–32 lowercase latin letters, digits or hyphens');

/** Prefix of the bot start payload that carries an invite token (accepted in T-12). */
export const INVITE_START_PREFIX = 'inv_';
export const OWNER_INVITE_TTL_HOURS = 72;

const planFields = {
  name: z.string().trim().min(1).max(64),
  maxStudents: z.number().int().min(1).max(100_000),
  maxStaff: z.number().int().min(1).max(10_000),
  maxStorageMb: z.number().int().min(1).max(1_000_000),
};

/** POST /platform/plans */
export const createPlanRequestSchema = z.object(planFields);
export type CreatePlanRequest = z.infer<typeof createPlanRequestSchema>;

/** PATCH /platform/plans/:id */
export const updatePlanRequestSchema = z
  .object(planFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');
export type UpdatePlanRequest = z.infer<typeof updatePlanRequestSchema>;

/** POST /platform/schools */
export const createSchoolRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  /** Generated when omitted. */
  code: schoolCodeSchema.optional(),
  currency: z.enum(CURRENCIES),
  timezone: timeZoneSchema,
  defaultLocale: z.enum(LOCALES).default('ru'),
  planId: z.uuid(),
  /** Shown in the staff list until the owner accepts the invite. */
  ownerName: z.string().trim().min(2).max(120),
});
export type CreateSchoolRequest = z.infer<typeof createSchoolRequestSchema>;

export const SCHOOL_STATUSES = ['active', 'blocked'] as const;
export type SchoolStatus = (typeof SCHOOL_STATUSES)[number];

/** PATCH /platform/schools/:id */
export const updateSchoolRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    planId: z.uuid(),
    status: z.enum(SCHOOL_STATUSES),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');
export type UpdateSchoolRequest = z.infer<typeof updateSchoolRequestSchema>;

export interface PlanDto {
  id: string;
  name: string;
  maxStudents: number;
  maxStaff: number;
  maxStorageMb: number;
  schoolsCount: number;
}

export interface PlatformSchoolDto {
  id: string;
  name: string;
  code: string;
  currency: Currency;
  timezone: string;
  defaultLocale: Locale;
  status: SchoolStatus;
  createdAt: string;
  plan: Pick<PlanDto, 'id' | 'name' | 'maxStudents' | 'maxStaff'>;
  /** People in staff roles, invited ones included. Students are counted from T-18. */
  staffCount: number;
  owner: { displayName: string; status: 'invited' | 'active' } | null;
  /** Set while an unused, unexpired owner invite exists. */
  ownerInviteExpiresAt: string | null;
}

/** POST /platform/schools/:id/owner-invite — the link is shown once and never stored. */
export interface OwnerInviteResponse {
  url: string;
  expiresAt: string;
}
