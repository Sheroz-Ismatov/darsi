import type { GuardianRelation } from '@darsi/shared';

export const RELATION_LABEL = {
  mother: 'students.relation.mother',
  father: 'students.relation.father',
  self: 'students.relation.self',
  other: 'students.relation.other',
} as const satisfies Record<GuardianRelation, string>;

export const fullName = (student: { firstName: string; lastName: string }): string =>
  `${student.lastName} ${student.firstName}`;

/** Full years on `today` (both `YYYY-MM-DD`, the school's calendar). */
export function ageOn(birthDate: string, today: string): number {
  const years = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return today.slice(5) < birthDate.slice(5) ? years - 1 : years;
}
