export const PHONE_DIGITS_MIN = 7;
export const PHONE_DIGITS_MAX = 15;

/**
 * Canonical form of a phone number: `+` and digits only, so `+992 90 123-45-67` and
 * `992901234567` are the same parent (T-18, decision 3). Returns null when the digit count
 * is outside what E.164 allows.
 */
export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (digits.length < PHONE_DIGITS_MIN || digits.length > PHONE_DIGITS_MAX) return null;
  return `+${digits}`;
}
