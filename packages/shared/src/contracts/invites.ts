import { z } from 'zod';
import type { Role } from '../constants';
import { schoolCodeSchema } from './platform';

/** Prefix of the bot start payload that carries an invite token. */
export const INVITE_START_PREFIX = 'inv_';

export const OWNER_INVITE_TTL_HOURS = 72;
export const STAFF_INVITE_TTL_HOURS = 7 * 24;
export const PARENT_INVITE_TTL_HOURS = 30 * 24;

/** Raw invite token as it appears after `inv_`; Telegram limits the whole payload to 64 characters. */
export const inviteTokenSchema = z.string().regex(/^[\w-]{20,64}$/, 'Malformed invite token');

/** POST /invites/accept — the token travels in the body so it never lands in access logs. */
export const acceptInviteRequestSchema = z.object({ token: inviteTokenSchema });
export type AcceptInviteRequest = z.infer<typeof acceptInviteRequestSchema>;

export interface InviteLinkResponse {
  url: string;
  expiresAt: string;
}

export interface JoinedMembership {
  id: string;
  schoolId: string;
  schoolName: string;
  role: Role;
}

export interface AcceptInviteResponse {
  membership: JoinedMembership;
  /** Admin panel address for owners and admins; null for other roles or when not configured. */
  webUrl: string | null;
}

/** POST /schools/by-code/:code/join */
export interface JoinSchoolResponse {
  membership: JoinedMembership;
  /** False when the user already was a parent of this school. */
  created: boolean;
}

export type StartPayload = { kind: 'invite'; token: string } | { kind: 'school'; code: string };

/** Meaning of the `/start` payload shared by the bot and the Mini App; anything malformed is ignored. */
export function parseStartPayload(value: string | null | undefined): StartPayload | null {
  if (!value) return null;
  if (value.startsWith(INVITE_START_PREFIX)) {
    const token = value.slice(INVITE_START_PREFIX.length);
    return inviteTokenSchema.safeParse(token).success ? { kind: 'invite', token } : null;
  }
  return schoolCodeSchema.safeParse(value).success ? { kind: 'school', code: value } : null;
}
