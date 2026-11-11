/** Interface languages: Russian and Tajik (ISO 639-1 `tg`). */
export const LOCALES = ['ru', 'tg'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ru';

/** School currencies. Amounts are stored as integers in minor units (diram / kopeck). */
export const CURRENCIES = ['TJS', 'RUB'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const ROLES = ['owner', 'admin', 'teacher', 'parent'] as const;
export type Role = (typeof ROLES)[number];

/** Course pastel colors from DESIGN_SYSTEM.md §1.2. */
export const COURSE_COLORS = ['lime', 'peach', 'coral', 'lavender', 'mint', 'butter'] as const;
export type CourseColor = (typeof COURSE_COLORS)[number];

export const COURSE_FORMATS = ['offline', 'online'] as const;
export type CourseFormat = (typeof COURSE_FORMATS)[number];

/** An individual course has groups of exactly one student (TZ FR-12). */
export const COURSE_KINDS = ['group', 'individual'] as const;
export type CourseKind = (typeof COURSE_KINDS)[number];

/** Course icon keys: lucide icon names in kebab-case, DESIGN_SYSTEM.md §7. */
export const COURSE_ICONS = [
  'book-open',
  'palette',
  'music',
  'dumbbell',
  'languages',
  'code',
  'calculator',
  'flask-conical',
  'bot',
  'brush',
  'trophy',
  'graduation-cap',
] as const;
export type CourseIcon = (typeof COURSE_ICONS)[number];

export const ATTENDANCE_STATUSES = ['present', 'absent', 'excused'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
