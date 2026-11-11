import type { MeResponse, Role } from '@darsi/shared';

/** A school the user can open in the admin panel, with all their roles in it. */
export interface WebSchool {
  id: string;
  name: string;
  roles: Role[];
}

export const SCHOOL_SECTIONS = [
  'dashboard',
  'schedule',
  'courses',
  'students',
  'requests',
  'subscriptions',
  'payments',
  'reports',
  'staff',
  'settings',
] as const;
export type Section = (typeof SCHOOL_SECTIONS)[number] | 'platform';

/** Staff and school settings are managed by the owner only (TZ §7.3). */
const OWNER_ONLY: ReadonlySet<Section> = new Set<Section>(['staff', 'settings']);

export const SECTION_PATH: Record<Section, string> = {
  dashboard: '/',
  schedule: '/schedule',
  courses: '/courses',
  students: '/students',
  requests: '/requests',
  subscriptions: '/subscriptions',
  payments: '/payments',
  reports: '/reports',
  staff: '/staff',
  settings: '/settings',
  platform: '/platform',
};

/** Pages that live outside a section path but keep its menu item highlighted. */
export const SECTION_SUBPATHS: Partial<Record<Section, readonly string[]>> = {
  courses: ['/groups/'],
};

/** The panel is for owners and admins (TZ FR-3); teachers and parents use the Mini App. */
export function webSchools(me: MeResponse): WebSchool[] {
  const schools = new Map<string, WebSchool>();
  for (const m of me.memberships) {
    if (m.status !== 'active' || (m.role !== 'owner' && m.role !== 'admin')) continue;
    const school = schools.get(m.schoolId);
    if (school) {
      school.roles.push(m.role);
    } else {
      schools.set(m.schoolId, { id: m.schoolId, name: m.schoolName, roles: [m.role] });
    }
  }
  return [...schools.values()];
}

/** Sections in menu order. The server enforces the same rules; this only shapes the UI. */
export function allowedSections(school: WebSchool | null, isSuperadmin: boolean): Section[] {
  const sections: Section[] = [];
  if (school) {
    const isOwner = school.roles.includes('owner');
    sections.push(...SCHOOL_SECTIONS.filter((s) => isOwner || !OWNER_ONLY.has(s)));
  }
  if (isSuperadmin) sections.push('platform');
  return sections;
}
