import type { TelegramLoginRequest } from '@darsi/shared';
import { useEffect, useRef } from 'react';

const WIDGET_SRC = 'https://telegram.org/js/telegram-widget.js?22';
const CALLBACK = 'darsiTelegramAuth';

declare global {
  interface Window {
    [CALLBACK]?: (user: TelegramLoginRequest) => void;
  }
}

/**
 * Official Telegram Login Widget (TZ FR-3). Telegram renders it only on the domain linked to the
 * bot in @BotFather (/setdomain), so it does not work on localhost — see T-40.
 */
export function TelegramLoginButton({
  botUsername,
  onAuth,
}: {
  botUsername: string;
  onAuth: (user: TelegramLoginRequest) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const handler = useRef(onAuth);

  useEffect(() => {
    handler.current = onAuth;
  }, [onAuth]);

  useEffect(() => {
    const host = container.current;
    if (!host) return;
    window[CALLBACK] = (user) => handler.current(user);

    const script = document.createElement('script');
    script.src = WIDGET_SRC;
    script.async = true;
    script.dataset.telegramLogin = botUsername;
    script.dataset.size = 'large';
    script.dataset.radius = '20';
    script.dataset.onauth = `${CALLBACK}(user)`;
    host.appendChild(script);

    return () => {
      host.replaceChildren();
      delete window[CALLBACK];
    };
  }, [botUsername]);

  return <div ref={container} className="flex min-h-10 justify-center" />;
}
