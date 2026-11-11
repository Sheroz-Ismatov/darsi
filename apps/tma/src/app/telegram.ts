import { DEFAULT_LOCALE, LOCALES, type Locale } from '@darsi/shared';

// Optional chaining: the bridge script may fail to load (offline, blocked telegram.org).
const webApp = window.Telegram?.WebApp as (typeof window.Telegram)['WebApp'] | undefined;

/** Outside Telegram the bridge script still loads, but `initData` is empty. */
export function isInsideTelegram(): boolean {
  return Boolean(webApp?.initData);
}

/** Dev-only escape hatch to work on screens in a regular browser (ARCHITECTURE.md §3.12). */
export const DEV_OUTSIDE_TELEGRAM =
  import.meta.env.DEV && import.meta.env.VITE_DEV_MOCK_INIT_DATA === 'true';

/** Raw signed launch data for POST /auth/tma; empty outside Telegram. */
export function initData(): string {
  return webApp?.initData ?? '';
}

// Read once: the router drops the query string as soon as it navigates away from the first screen.
const LAUNCH_QUERY = new URLSearchParams(window.location.search);

/**
 * Launch payload (school code or invite): `start_param` for t.me/<bot>?startapp links,
 * `?start=` for the bot's /start button (see apps/api bot/start-reply.ts).
 */
export function launchParam(): string | null {
  return webApp?.initDataUnsafe.start_param ?? LAUNCH_QUERY.get('start');
}

const DEFAULT_DEV_TELEGRAM_ID = 1_000_000_001;

/**
 * Telegram id for the browser dev mode (needs AUTH_DEV_BYPASS=true on the API).
 * `?devUser=<id>` lets one browser play a second person in invite scenarios.
 */
export function devTelegramId(): number {
  const requested = LAUNCH_QUERY.get('devUser');
  return requested && /^[1-9]\d{0,14}$/.test(requested)
    ? Number(requested)
    : DEFAULT_DEV_TELEGRAM_ID;
}

/** Opens a page outside the Mini App: Telegram's in-app browser, or a new tab in dev mode. */
export function openExternal(url: string): void {
  if (webApp && isInsideTelegram()) {
    webApp.openLink(url);
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

export function telegramLocale(): Locale {
  const code = webApp?.initDataUnsafe.user?.language_code;
  return LOCALES.find((locale) => locale === code) ?? DEFAULT_LOCALE;
}

function applyTheme(): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const scheme = webApp?.colorScheme ?? (prefersDark ? 'dark' : 'light');
  document.documentElement.dataset.theme = scheme;

  // Paint Telegram's own header and background with our --bg (DESIGN_SYSTEM.md §1.4).
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (webApp && /^#[0-9a-f]{6}$/i.test(bg)) {
    webApp.setHeaderColor(bg as `#${string}`);
    webApp.setBackgroundColor(bg as `#${string}`);
  }
}

export function initTelegram(): void {
  applyTheme();
  if (!webApp) return;
  webApp.onEvent('themeChanged', applyTheme);
  webApp.ready();
  webApp.expand();
}

/** Shows Telegram's native back button while `onBack` is set. */
export function setBackButton(onBack: (() => void) | null): () => void {
  const button = webApp?.BackButton;
  if (!button) return () => undefined;
  if (!onBack) {
    button.hide();
    return () => undefined;
  }
  button.onClick(onBack);
  button.show();
  return () => {
    button.offClick(onBack);
    button.hide();
  };
}
