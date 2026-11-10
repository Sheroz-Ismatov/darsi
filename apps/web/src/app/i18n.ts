import { I18N_RESOURCES, type Dictionary } from '@darsi/shared';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { webRu, type WebDictionary } from './locales/ru';

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: Dictionary & WebDictionary };
  }
}

// The admin panel is Russian-only in the MVP (TZ FR-61).
void i18n.use(initReactI18next).init({
  resources: { ru: { translation: { ...I18N_RESOURCES.ru.translation, ...webRu } } },
  lng: 'ru',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
});

export default i18n;
