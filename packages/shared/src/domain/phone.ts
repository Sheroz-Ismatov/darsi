export const PHONE_DIGITS_MIN = 7;
export const PHONE_DIGITS_MAX = 15;

const PHONE_CHARS = /^\s*\+?[\d\s()-]*$/;

/**
 * Canonical form of a phone number: `+` and digits only, so `+992 90 123-45-67` and
 * `992901234567` are the same parent (T-18, decision 3). Returns null for anything but digits
 * with an optional leading `+`, spaces, brackets and dashes, or when the digit count is outside
 * what E.164 allows.
 */
export function normalizePhone(value: string): string | null {
  if (!PHONE_CHARS.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < PHONE_DIGITS_MIN || digits.length > PHONE_DIGITS_MAX) return null;
  return `+${digits}`;
}
