/**
 * Turns what people actually type ("9", "930", "9:30", "16.00") into HH:mm.
 * Anything else is left as is so the schema reports it.
 */
export const normalizeTime = (value: string): string => {
  const match = /^(\d{1,2})(?:[:.]?(\d{2}))?$/.exec(value.trim());
  if (!match) return value;
  const [, hours = '', minutes = '00'] = match;
  return `${hours.padStart(2, '0')}:${minutes}`;
};

/** Keeps only what a time can contain while the field is being typed in. */
export const timeChars = (value: string): string => value.replace(/[^\d:.]/g, '');
