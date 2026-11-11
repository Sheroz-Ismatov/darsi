/** Zones of the pilot markets: Tajikistan and its neighbours, then Russia west to east. */
export const TIMEZONES = [
  'Asia/Dushanbe',
  'Asia/Tashkent',
  'Asia/Almaty',
  'Europe/Moscow',
  'Europe/Samara',
  'Asia/Yekaterinburg',
  'Asia/Novosibirsk',
  'Asia/Krasnoyarsk',
  'Asia/Vladivostok',
];

/** The list plus the current value when the API holds a zone outside it, so a select never loses it. */
export function timezoneOptions(current: string): string[] {
  return TIMEZONES.includes(current) ? TIMEZONES : [current, ...TIMEZONES];
}
