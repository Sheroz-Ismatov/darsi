import type { Locale } from '../constants';
import { ru, type Dictionary } from './ru';
import { tg } from './tg';

export type { Dictionary };

/** i18next-compatible resources: one `translation` namespace per locale. */
export const I18N_RESOURCES: Record<Locale, { translation: Dictionary }> = {
  ru: { translation: ru },
  tg: { translation: tg },
};
