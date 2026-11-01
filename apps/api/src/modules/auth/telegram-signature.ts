import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/** Signed data is accepted for 24 hours (TZ FR-2). */
export const SIGNATURE_MAX_AGE_SECONDS = 24 * 60 * 60;

export type SignatureFailure = 'INVALID' | 'EXPIRED';

export class TelegramSignatureError extends Error {
  constructor(readonly reason: SignatureFailure) {
    super(`Telegram signature check failed: ${reason}`);
    this.name = 'TelegramSignatureError';
  }
}

export interface TelegramUserData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface VerifiedInitData {
  user: TelegramUserData;
  authDate: Date;
  startParam: string | null;
}

export interface VerifiedLoginWidget {
  user: TelegramUserData;
  authDate: Date;
}

function hmacHex(key: Buffer, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex');
}

function sameHash(expectedHex: string, receivedHex: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(receivedHex)) return false;
  return timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(receivedHex, 'hex'));
}

/** `key=value` pairs sorted by key and joined with \n — Telegram's data-check-string. */
function dataCheckString(fields: Array<[string, string]>): string {
  return fields
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

function checkAge(authDateSeconds: number, now: Date, maxAgeSeconds: number): Date {
  if (!Number.isInteger(authDateSeconds) || authDateSeconds <= 0) {
    throw new TelegramSignatureError('INVALID');
  }
  if (now.getTime() / 1000 - authDateSeconds > maxAgeSeconds) {
    throw new TelegramSignatureError('EXPIRED');
  }
  return new Date(authDateSeconds * 1000);
}

function isTelegramUser(value: unknown): value is TelegramUserData {
  if (typeof value !== 'object' || value === null) return false;
  const user = value as Record<string, unknown>;
  return Number.isInteger(user.id) && (user.id as number) > 0 && typeof user.first_name === 'string';
}

/**
 * Mini App `initData` check:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyInitData(
  initData: string,
  botToken: string,
  now: Date = new Date(),
  maxAgeSeconds: number = SIGNATURE_MAX_AGE_SECONDS,
): VerifiedInitData {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new TelegramSignatureError('INVALID');
  params.delete('hash');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  if (!sameHash(hmacHex(secret, dataCheckString([...params.entries()])), hash)) {
    throw new TelegramSignatureError('INVALID');
  }

  const authDate = checkAge(Number(params.get('auth_date')), now, maxAgeSeconds);

  let user: unknown;
  try {
    user = JSON.parse(params.get('user') ?? '');
  } catch {
    throw new TelegramSignatureError('INVALID');
  }
  if (!isTelegramUser(user)) throw new TelegramSignatureError('INVALID');

  return { user, authDate, startParam: params.get('start_param') };
}

/**
 * Telegram Login Widget check:
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyLoginWidget(
  data: Record<string, string | number | undefined>,
  botToken: string,
  now: Date = new Date(),
  maxAgeSeconds: number = SIGNATURE_MAX_AGE_SECONDS,
): VerifiedLoginWidget {
  const { hash, ...rest } = data;
  if (typeof hash !== 'string') throw new TelegramSignatureError('INVALID');

  const fields = Object.entries(rest)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]): [string, string] => [key, String(value)]);

  const secret = createHash('sha256').update(botToken).digest();
  if (!sameHash(hmacHex(secret, dataCheckString(fields)), hash)) {
    throw new TelegramSignatureError('INVALID');
  }

  const authDate = checkAge(Number(rest.auth_date), now, maxAgeSeconds);
  const user = {
    id: Number(rest.id),
    first_name: rest.first_name,
    last_name: rest.last_name,
    username: rest.username,
  };
  if (!isTelegramUser(user)) throw new TelegramSignatureError('INVALID');

  return { user, authDate };
}
