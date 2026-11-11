import type { MeResponse, TmaAuthResponse } from '@darsi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { apiFetch, setAccessToken } from './api';
import { DEV_OUTSIDE_TELEGRAM, devTelegramId, initData, isInsideTelegram } from './telegram';

const SESSION_KEY = ['session'] as const;

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
      body: JSON.stringify({ telegramId: devTelegramId(), firstName: 'Dev' }),
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
    queryKey: SESSION_KEY,
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

/** Reloads the profile after the user's memberships changed, without signing in again. */
export function useRefreshSession(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    queryClient.setQueryData(SESSION_KEY, await apiFetch<MeResponse>('/me'));
  }, [queryClient]);
}

/** Start screen by role until the role switcher of T-36: teachers see their schedule first. */
export function homePath(me: MeResponse): string {
  const isTeacher = me.memberships.some((m) => m.role === 'teacher' && m.status === 'active');
  return isTeacher ? '/teacher' : '/parent';
}
