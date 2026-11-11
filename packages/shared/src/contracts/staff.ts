import { z } from 'zod';
import type { Role } from '../constants';
import { clearablePhoneSchema as phoneSchema } from './school';

/** Roles the owner can hand out; the owner role itself is set by the platform (TZ FR-1, FR-10). */
export const STAFF_INVITE_ROLES = ['admin', 'teacher'] as const;
export type StaffInviteRole = (typeof STAFF_INVITE_ROLES)[number];

export const STAFF_ROLE_FILTER = ['owner', 'admin', 'teacher'] as const;
export const STAFF_STATUSES = ['invited', 'active', 'deactivated'] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

const displayNameSchema = z.string().trim().min(2).max(120);

/** GET /staff query */
export const listStaffQuerySchema = z.object({
  role: z.enum(STAFF_ROLE_FILTER).optional(),
  status: z.enum(STAFF_STATUSES).optional(),
});
export type ListStaffQuery = z.infer<typeof listStaffQuerySchema>;

/** POST /staff */
export const createStaffRequestSchema = z.object({
  displayName: displayNameSchema,
  phone: phoneSchema.optional(),
  role: z.enum(STAFF_INVITE_ROLES),
});
export type CreateStaffRequest = z.infer<typeof createStaffRequestSchema>;
export type CreateStaffInput = z.input<typeof createStaffRequestSchema>;

/** PATCH /staff/:id — the role never changes: another role is another membership. */
export const updateStaffRequestSchema = z
  .object({
    displayName: displayNameSchema,
    phone: phoneSchema,
    status: z.enum(['active', 'deactivated']),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');
export type UpdateStaffRequest = z.infer<typeof updateStaffRequestSchema>;

export interface StaffMemberDto {
  /** Membership id. */
  id: string;
  displayName: string;
  phone: string | null;
  role: Extract<Role, 'owner' | 'admin' | 'teacher'>;
  status: StaffStatus;
  /** The membership belongs to the user making the request. */
  isSelf: boolean;
  /** Set while an unused, unexpired invite link exists. */
  inviteExpiresAt: string | null;
  createdAt: string;
}

/** GET /staff — `limit` counts people, invited ones included (TZ FR-6). */
export interface StaffListResponse {
  items: StaffMemberDto[];
  limit: { used: number; max: number };
}
