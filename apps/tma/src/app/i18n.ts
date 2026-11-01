import { DEFAULT_LOCALE, I18N_RESOURCES, type Dictionary } from '@darsi/shared';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { telegramLocale } from './telegram';

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: Dictionary };
  }
}

// TODO(T-36): prefer the language saved in the user's profile over Telegram's language.
void i18n.use(initReactI18next).init({
  resources: I18N_RESOURCES,
  lng: telegramLocale(),
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
});

export default i18n;
