import type { AuthTokenResponse, MeResponse, TelegramLoginRequest } from '@darsi/shared';
import { useQuery, useQueryClient, type Query } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ApiError,
  apiFetch,
  hasAccessToken,
  refreshSession,
  setAccessToken,
  setSchoolId,
  setSessionLostHandler,
} from '../../lib/api';
import { allowedSections, webSchools, type Section, type WebSchool } from './access';

const SESSION_KEY = ['session'] as const;
const SCHOOL_KEY = 'darsi.school';

const isNotSession = (query: Query): boolean => query.queryKey[0] !== SESSION_KEY[0];

function readStoredSchool(): string | null {
  try {
    return localStorage.getItem(SCHOOL_KEY);
  } catch {
    return null;
  }
}

/** Restores the session from the refresh cookie; null means "signed out". */
async function loadSession(): Promise<MeResponse | null> {
  if (!hasAccessToken() && !(await refreshSession())) return null;
  try {
    return await apiFetch<MeResponse>('/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

interface AuthActions {
  /** Development only (AUTH_DEV_BYPASS on the API). */
  devLogin: (telegramId: number) => Promise<void>;
  telegramLogin: (data: TelegramLoginRequest) => Promise<void>;
  signOut: () => Promise<void>;
}

export interface Session {
  me: MeResponse;
  /** Schools available in the panel; empty for a platform-only superadmin. */
  schools: WebSchool[];
  school: WebSchool | null;
  sections: Section[];
  selectSchool: (id: string) => void;
}

const AuthContext = createContext<(AuthActions & { session: Session | null }) | null>(null);

export function AuthProvider({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: (state: 'loading' | 'error', retry: () => void) => ReactNode;
}) {
  const queryClient = useQueryClient();
  const [schoolId, setCurrentSchoolId] = useState(readStoredSchool);
  const query = useQuery({ queryKey: SESSION_KEY, queryFn: loadSession, staleTime: Infinity });
  const me = query.data ?? null;

  useEffect(() => {
    setSessionLostHandler(() => queryClient.setQueryData(SESSION_KEY, null));
    return () => setSessionLostHandler(() => undefined);
  }, [queryClient]);

  const session = useMemo<Session | null>(() => {
    if (!me) return null;
    const schools = webSchools(me);
    const school = schools.find((s) => s.id === schoolId) ?? schools[0] ?? null;
    return {
      me,
      schools,
      school,
      sections: allowedSections(school, me.user.isSuperadmin),
      selectSchool: (id) => {
        try {
          localStorage.setItem(SCHOOL_KEY, id);
        } catch {
          // Storage may be unavailable (private mode); the choice just won't persist.
        }
        setSchoolId(id);
        // Nothing loaded for the previous school may stay on screen (TZ FR-4).
        queryClient.removeQueries({ predicate: isNotSession });
        setCurrentSchoolId(id);
      },
    };
  }, [me, schoolId, queryClient]);

  // Set before children render, so their first requests already carry the school.
  setSchoolId(session?.school?.id ?? null);

  const actions = useMemo<AuthActions>(() => {
    const start = async (path: string, body: unknown) => {
      const auth = await apiFetch<AuthTokenResponse>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setAccessToken(auth.accessToken);
      await queryClient.fetchQuery({ queryKey: SESSION_KEY, queryFn: loadSession, staleTime: 0 });
    };
    return {
      devLogin: (telegramId) => start('/auth/dev-login', { telegramId }),
      telegramLogin: (data) => start('/auth/telegram-login', data),
      signOut: async () => {
        await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
        setAccessToken(null);
        queryClient.removeQueries({ predicate: isNotSession });
        queryClient.setQueryData(SESSION_KEY, null);
      },
    };
  }, [queryClient]);

  const value = useMemo(() => ({ ...actions, session }), [actions, session]);

  if (query.isPending) return fallback('loading', () => undefined);
  if (query.isError) return fallback('error', () => void query.refetch());
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthActions & { session: Session | null } {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return auth;
}

/** For pages behind RequireSession. */
export function useSession(): Session {
  const { session } = useAuth();
  if (!session) {
    throw new Error('useSession used outside a signed-in route');
  }
  return session;
}
