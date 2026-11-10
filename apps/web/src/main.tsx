import { Button } from '@darsi/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { AuthProvider } from './app/auth/session';
import i18n from './app/i18n';
import { queryClient } from './app/query-client';
import { router } from './app/router';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('#root element is missing in index.html');
}

/** Shown while the session is being restored, or when the API is unreachable. */
function sessionFallback(state: 'loading' | 'error', retry: () => void) {
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 text-center text-ink-2">
      {state === 'loading' ? (
        i18n.t('common.loading')
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div role="alert">{i18n.t('auth.sessionError')}</div>
          <Button onClick={retry}>{i18n.t('common.retry')}</Button>
        </div>
      )}
    </div>
  );
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider fallback={sessionFallback}>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
