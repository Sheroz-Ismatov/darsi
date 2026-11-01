import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import './app/i18n';
import { router } from './app/router';
import { DEV_OUTSIDE_TELEGRAM, initTelegram, isInsideTelegram } from './app/telegram';
import { OpenInTelegramScreen } from './pages/OpenInTelegramScreen';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('#root element is missing in index.html');
}

initTelegram();
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
const canRun = isInsideTelegram() || DEV_OUTSIDE_TELEGRAM;

createRoot(root).render(
  <StrictMode>
    {canRun ? (
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    ) : (
      <OpenInTelegramScreen />
    )}
  </StrictMode>,
);
