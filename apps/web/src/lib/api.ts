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

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network request failed');
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
