import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/api';

/** Retry only network failures and 5xx; 4xx are final answers from the API. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) =>
        failureCount < 2 &&
        error instanceof ApiError &&
        (error.status === 0 || error.status >= 500),
    },
  },
});
