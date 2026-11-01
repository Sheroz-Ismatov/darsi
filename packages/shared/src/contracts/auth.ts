import { z } from 'zod';
import type { Locale, Role } from '../constants';

/** POST /auth/tma — raw `Telegram.WebApp.initData` string. */
export const tmaAuthRequestSchema = z.object({
  initData: z.string().min(1).max(4096),
});
export type TmaAuthRequest = z.infer<typeof tmaAuthRequestSchema>;

/**
 * POST /auth/telegram-login — payload of the Telegram Login Widget, passed through as is.
 * Unknown fields are kept: the signature covers every field Telegram sends.
 */
export const telegramLoginRequestSchema = z
  .object({
    id: z.number().int().positive(),
    first_name: z.string().max(256),
    last_name: z.string().max(256).optional(),
    username: z.string().max(64).optional(),
    photo_url: z.string().max(2048).optional(),
    auth_date: z.number().int().positive(),
    hash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .catchall(z.union([z.string().max(2048), z.number()]));
export type TelegramLoginRequest = z.infer<typeof telegramLoginRequestSchema>;

/** POST /auth/dev-login — development only (AUTH_DEV_BYPASS). */
export const devLoginRequestSchema = z.object({
  telegramId: z.number().int().positive(),
  firstName: z.string().min(1).max(64).default('Dev'),
});
export type DevLoginRequest = z.infer<typeof devLoginRequestSchema>;

export interface AuthTokenResponse {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

export interface TmaAuthResponse extends AuthTokenResponse {
  /** `startapp` deep-link payload, e.g. a school code (T-12). */
  startParam: string | null;
}

export interface MeResponse {
  user: {
    id: string;
    /** Telegram ids exceed 2^53 in theory, so they travel as strings. */
    telegramId: string;
    firstName: string;
    lastName: string | null;
    username: string | null;
    locale: Locale;
    isSuperadmin: boolean;
  };
  memberships: Array<{
    id: string;
    schoolId: string;
    schoolName: string;
    role: Role;
    status: 'invited' | 'active' | 'deactivated';
  }>;
}
