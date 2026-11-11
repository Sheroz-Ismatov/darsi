import { z } from 'zod';
import { CURRENCIES, LOCALES, type Currency, type Locale } from '../constants';
import { timeZoneSchema } from './platform';

export const REMINDER_HOURS_MIN = 1;
export const REMINDER_HOURS_MAX = 48;

const PHONE_PATTERN = /^[+\d][\d\s()-]{4,30}$/;

/** Optional phone number: an empty string clears it, so it is stored as null. */
export const clearablePhoneSchema = z
  .string()
  .trim()
  .max(32)
  .refine((value) => value === '' || PHONE_PATTERN.test(value), 'Invalid phone number')
  .transform((value) => (value === '' ? null : value))
  .nullable();

/** Optional free text: an empty string clears the field, so it is stored as null. */
const clearableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable();

/** PATCH /school — the owner edits the profile and rules of the current school (TZ FR-7, FR-8). */
export const updateSchoolSettingsRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    address: clearableText(200),
    phone: clearablePhoneSchema,
    description: clearableText(1000),
    timezone: timeZoneSchema,
    currency: z.enum(CURRENCIES),
    defaultLocale: z.enum(LOCALES),
    chargeAbsent: z.boolean(),
    chargeExcused: z.boolean(),
    reminderHoursBefore: z.number().int().min(REMINDER_HOURS_MIN).max(REMINDER_HOURS_MAX),
    debtRemindersEnabled: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');
export type UpdateSchoolSettingsRequest = z.infer<typeof updateSchoolSettingsRequestSchema>;
export type UpdateSchoolSettingsInput = z.input<typeof updateSchoolSettingsRequestSchema>;

/** GET /school — the current school as owners and admins see it. */
export interface SchoolDto {
  id: string;
  name: string;
  code: string;
  currency: Currency;
  timezone: string;
  defaultLocale: Locale;
  address: string | null;
  phone: string | null;
  description: string | null;
  chargeAbsent: boolean;
  chargeExcused: boolean;
  reminderHoursBefore: number;
  debtRemindersEnabled: boolean;
  /** True once the school has a payment: the currency can no longer change (TZ FR-7). */
  currencyLocked: boolean;
  /** Public link parents open to enter the school (TZ FR-9). */
  joinUrl: string;
}
