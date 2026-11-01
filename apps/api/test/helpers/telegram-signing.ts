// Test-side signer following Telegram's documented algorithms, used to produce valid payloads.
import { createHash, createHmac } from 'node:crypto';

export const TEST_BOT_TOKEN = '1234567890:TEST-bot-token_for-unit-tests-only';

function checkString(fields: Record<string, string>): string {
  return Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
}

export function signInitData(
  fields: { user: object; auth_date: number; [key: string]: unknown },
  botToken = TEST_BOT_TOKEN,
): string {
  const plain: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    plain[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(checkString(plain)).digest('hex');
  return new URLSearchParams({ ...plain, hash }).toString();
}

export function signLoginWidget<T extends Record<string, string | number>>(
  fields: T,
  botToken = TEST_BOT_TOKEN,
): T & { hash: string } {
  const plain = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)]));
  const secret = createHash('sha256').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(checkString(plain)).digest('hex');
  return { ...fields, hash };
}

export const nowSeconds = (): number => Math.floor(Date.now() / 1000);
