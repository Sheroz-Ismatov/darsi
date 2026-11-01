import type { Role } from '@darsi/shared';
import type { AuthenticatedRequest } from '../auth/auth.decorators';

/** Request header that selects the school for school-scoped endpoints (ARCHITECTURE.md §3.4). */
export const SCHOOL_HEADER = 'x-school-id';

export const SCHOOL_ROLES = 'tenancy:schoolRoles';

/** Resolved by SchoolGuard; every school-scoped query must filter by `schoolId`. */
export interface SchoolContext {
  schoolId: string;
  /** All active roles of the user in this school (e.g. teacher and parent at once). */
  roles: Role[];
}

export type TenantRequest = AuthenticatedRequest & { school?: SchoolContext };
