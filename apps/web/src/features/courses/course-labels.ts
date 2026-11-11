import type { CourseColor, CourseFormat, CourseKind } from '@darsi/shared';
import type { TFunction } from 'i18next';

export const FORMAT_LABEL = {
  offline: 'courses.formatOffline',
  online: 'courses.formatOnline',
} as const satisfies Record<CourseFormat, string>;

export const KIND_LABEL = {
  group: 'courses.kindGroup',
  individual: 'courses.kindIndividual',
} as const satisfies Record<CourseKind, string>;

export const COLOR_LABEL = {
  lime: 'courses.colorLime',
  peach: 'courses.colorPeach',
  coral: 'courses.colorCoral',
  lavender: 'courses.colorLavender',
  mint: 'courses.colorMint',
  butter: 'courses.colorButter',
} as const satisfies Record<CourseColor, string>;

/** «6–10 лет», «от 6 лет», «до 10 лет», or null when no age is set. */
export function ageText(t: TFunction, from: number | null, to: number | null): string | null {
  if (from !== null && to !== null) return t('courses.ageRange', { from, to });
  if (from !== null) return t('courses.ageFrom', { from });
  if (to !== null) return t('courses.ageTo', { to });
  return null;
}
