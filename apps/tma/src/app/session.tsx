import type { MeResponse, TmaAuthResponse } from '@darsi/shared';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';
import { apiFetch, setAccessToken } from './api';
import { DEV_OUTSIDE_TELEGRAM, initData, isInsideTelegram } from './telegram';

/** Fixed Telegram id for the browser dev mode (needs AUTH_DEV_BYPASS=true on the API). */
const DEV_TELEGRAM_ID = 1_000_000_001;

async function signIn(): Promise<MeResponse> {
  if (isInsideTelegram()) {
    const auth = await apiFetch<TmaAuthResponse>('/auth/tma', {
      method: 'POST',
      body: JSON.stringify({ initData: initData() }),
    });
    setAccessToken(auth.accessToken);
  } else if (DEV_OUTSIDE_TELEGRAM) {
    const auth = await apiFetch<{ accessToken: string }>('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ telegramId: DEV_TELEGRAM_ID, firstName: 'Dev' }),
    });
    setAccessToken(auth.accessToken);
  }
  return apiFetch<MeResponse>('/me');
}

const SessionContext = createContext<MeResponse | null>(null);

/**
 * Every launch exchanges fresh initData for an access token (ARCHITECTURE.md §3.8),
 * then loads the profile. Children render only for a signed-in user.
 */
export function SessionProvider({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: (state: 'loading' | 'error', retry: () => void) => ReactNode;
}) {
  const session = useQuery({
    queryKey: ['session'],
    queryFn: signIn,
    staleTime: Infinity,
    retry: 1,
  });

  if (session.isPending) return fallback('loading', () => undefined);
  if (session.isError) return fallback('error', () => void session.refetch());
  return <SessionContext.Provider value={session.data}>{children}</SessionContext.Provider>;
}

export function useSession(): MeResponse {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return session;
}
