import { describe, expect, it } from 'vitest';
import { normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('gives one form to differently written numbers', () => {
    expect(normalizePhone('+992 90 123-45-67')).toBe('+992901234567');
    expect(normalizePhone('992901234567')).toBe('+992901234567');
    expect(normalizePhone('(992) 90-123-45-67')).toBe('+992901234567');
  });

  it('accepts 7 to 15 digits', () => {
    expect(normalizePhone('123-45-67')).toBe('+1234567');
    expect(normalizePhone('1'.repeat(15))).toBe(`+${'1'.repeat(15)}`);
  });

  it('rejects too short, too long and digitless values', () => {
    expect(normalizePhone('12-34-56')).toBeNull();
    expect(normalizePhone('1'.repeat(16))).toBeNull();
    expect(normalizePhone('телефон')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
});
