import { DEFAULT_LOCALE, I18N_RESOURCES, LOCALES, type Locale } from '@darsi/shared';

/** `/start` payload: school code or invite token (T-12). Anything else is ignored. */
const PAYLOAD = /^[\w-]{1,64}$/;

export interface StartReply {
  text: string;
  /** Inline button that opens the Mini App; absent when TMA_URL is not configured. */
  button?: { text: string; url: string };
}

export function botLocale(languageCode: string | undefined): Locale {
  return LOCALES.find((locale) => locale === languageCode) ?? DEFAULT_LOCALE;
}

/**
 * Reply to `/start [payload]`. The payload travels to the Mini App as `?start=` because
 * `start_param` in initData is filled only for t.me/<bot>?startapp links, not for buttons.
 */
export function buildStartReply(
  payload: string | undefined,
  languageCode: string | undefined,
  tmaUrl: string | undefined,
): StartReply {
  const texts = I18N_RESOURCES[botLocale(languageCode)].translation.bot;
  if (!tmaUrl) {
    return { text: texts.unavailable };
  }
  const url = new URL(tmaUrl);
  if (payload && PAYLOAD.test(payload)) {
    url.searchParams.set('start', payload);
  }
  return { text: texts.welcome, button: { text: texts.openApp, url: url.toString() } };
}
