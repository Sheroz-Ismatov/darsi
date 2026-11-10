import type { AuthTokenResponse } from '@darsi/shared';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

/** Error in the API format `{ error: { code, message, details } }` (ARCHITECTURE.md §3.7). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: Record<string, unknown> };
}

// The access token lives only in memory; the refresh token is an httpOnly cookie (ARCHITECTURE.md §3.8).
let accessToken: string | null = null;
let schoolId: string | null = null;
let onSessionLost: () => void = () => undefined;
let refreshing: Promise<boolean> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function hasAccessToken(): boolean {
  return accessToken !== null;
}

/** School sent as X-School-Id with every request; null for platform-only sessions. */
export function setSchoolId(id: string | null): void {
  schoolId = id;
}

/** Called when the session cannot be renewed any more (refresh token expired or revoked). */
export function setSessionLostHandler(handler: () => void): void {
  onSessionLost = handler;
}

async function request(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        ...(schoolId && { 'X-School-Id': schoolId }),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network request failed');
  }
}

/**
 * Exchanges the refresh cookie for a new access token. Refresh tokens are single-use, so
 * concurrent callers share one request: a second parallel rotation would revoke the session.
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const response = await request('/auth/refresh', { method: 'POST' });
      if (!response.ok) {
        // A network or server failure is not a verdict on the session.
        if (response.status === 401) accessToken = null;
        return false;
      }
      accessToken = ((await response.json()) as AuthTokenResponse).accessToken;
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await request(path, init);
  // An expired access token is renewed once, transparently for the caller.
  if (response.status === 401 && accessToken && !path.startsWith('/auth/')) {
    if (await refreshSession()) {
      response = await request(path, init);
    } else if (!accessToken) {
      onSessionLost();
    }
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = (body as ErrorBody | undefined)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? response.statusText,
      error?.details,
    );
  }
  return body as T;
}
